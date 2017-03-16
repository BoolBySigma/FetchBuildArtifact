import * as task from 'vsts-task-lib/task';
import * as process from 'process';
import * as request from 'request';
import * as rpn from 'request-promise-native';
import * as path from 'path';
import * as fs from 'fs';
import * as admZip from 'adm-zip';

function stringIsNullOrEmpty(val: string): boolean {
    if (val === undefined || val === null || val.trim() === '') {
        return true;
    }
    return false;
};

function getRequestOptions(options: any) {
    var baseOptions = {
        auth: {
            bearer: process.env['SYSTEM_ACCESSTOKEN']
        },
        headers: {
            Authorization: {
                Bearer: process.env['SYSTEM_ACCESSTOKEN']
            }
        },
        json: true,
        qs: {}
    }
    options = Object.assign(baseOptions, options);
    options.qs = Object.assign(options.qs, { 'api-version': '2.0' });

    return options;
}

async function run() {
    try {
        let project = task.getInput('project', false);
        if (stringIsNullOrEmpty(project)) {
            task.debug('project is null or empty');
            task.debug('project defaulting to ' + process.env['SYSTEM_TEAMPROJECT']);
            project = process.env['SYSTEM_TEAMPROJECT'];
            task.debug('project=' + process.env['SYSTEM_TEAMPROJECT']);
        }

        let buildDefinitionId = task.getInput('buildDefinitionId', true);
        let definitionId = Number(buildDefinitionId);
        if (Number.isNaN(definitionId)) {
            throw new Error('Build Definition Id must be a numerical value');
        }

        let artifactName = task.getInput('artifactName', true);

        let targetDirectory = task.getInput('targetDirectory', false);
        if (stringIsNullOrEmpty(targetDirectory)) {
            task.debug('targetDirectory is null or empty');
            task.debug('targetDirectory defaulting to ' + process.env['BUILD_SOURCESDIRECTORY']);
            targetDirectory = process.env['BUILD_SOURCESDIRECTORY'];
            task.debug('targetDirectory=' + process.env['BUILD_SOURCESDIRECTORY']);
        }

        let accountUri = process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        task.debug('accountUri=' + accountUri);

        let projectUri = accountUri + project;
        task.debug('projectUri=' + projectUri);

        let buildsUri = projectUri + '/_apis/build/builds';
        task.debug('buildsUri=' + buildsUri);

        var buildsOptions = getRequestOptions({
            uri: buildsUri,
            qs: {
                definitions: definitionId,
                statusFilter: 'completed',
                resultFilter: 'succeeded',
                $top: 1
            }
        });
        task.debug('buildsOption:');
        task.debug(JSON.stringify(buildsOptions));

        console.log('Querying completed successful builds of build definition \'' + definitionId + '\'');

        await rpn(buildsOptions)
            .then(function (builds: any) {
                let build = builds.value[0];

                if (!build) {
                    task.debug('no build found');
                    return null;
                }

                task.debug('build:');
                task.debug(JSON.stringify(build));

                return build.id;
            })
            .catch(function (err) {
                throw new Error('Could not find project \'' + project + '\'. Make sure \'Allow Scripts to Access OAuth Token\' is enabled and that the project exists.');
            })
            .then(function (buildId) {
                task.debug('buildId=' + buildId);
                if (!buildId) {
                    throw new Error('Could not find a completed successful build. Ensure that build definition \'' + definitionId + '\' has a successful build.');
                }

                console.log('Found build \'' + buildId + '\'');

                let buildArtifactUri = projectUri + '/_apis/build/builds/' + buildId + '/artifacts?api-version=2.0'

                var buildArtifactOptions = getRequestOptions({ uri: buildArtifactUri });
                task.debug('buildArtifactOptions:');
                task.debug(JSON.stringify(buildArtifactOptions));

                console.log('Querying build artifact \'' + artifactName + '\'');
                return rpn(buildArtifactOptions);
            })
            .then(function (results: any) {
                if (results.count === '0') {
                    throw new Error('Could not find build');
                }

                let artifacts: any[] = results.value;

                let artifact = artifacts.find(a => a.name === artifactName);

                if (!artifact) {
                    throw new Error('Could not find build artifact \'' + artifactName + '\'');
                }

                console.log('Found build artifact \'' + artifactName + '\'');
                let artifactUri: string = artifact.resource.downloadUrl;

                return artifactUri;
            })
            .then(function (artifactUri: string) {
                let artifactPath = path.join(targetDirectory, artifactName + '.zip');

                var downloadOptions = getRequestOptions({ uri: artifactUri });

                return new Promise(function (resolve, reject) {

                    console.log('Downloading build artifact \'' + artifactName + '\' to ' + artifactPath);

                    request(artifactUri, downloadOptions)
                        .pipe(fs.createWriteStream(artifactPath))
                        .on('error', function (err) {
                            task.debug('download failed');
                            task.debug(err.message);
                            reject('Could not download build artifact from ' + artifactUri);
                        })
                        .on('finish', function () {
                            console.log('Download completed');
                            resolve(artifactPath);
                        });
                });

            })
            .then(function (artifactPath: string) {
                console.log('Extracting ' + artifactPath + ' to ' + path.join(targetDirectory, artifactName));
                let zip = new admZip(artifactPath);
                zip.extractAllTo(targetDirectory, true);
                console.log('Extraction completed');
            });

    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();