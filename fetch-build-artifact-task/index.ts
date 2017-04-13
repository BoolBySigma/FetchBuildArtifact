import * as task from 'vsts-task-lib/task';
import * as request from 'request';
import * as rpn from 'request-promise-native';
import * as path from 'path';
import * as fs from 'fs';
import * as admZip from 'adm-zip';

function getRequestOptions(options: any): any {
    var baseOptions = {
        auth: {
            bearer: task.getVariable('System.AccessToken')
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
        let enableAccessToken = task.getVariable('system.enableAccessToken') == 'true';
        if (!enableAccessToken) {
            throw new Error('\'Allow Scripts to Access OAuth Token\' must be enabled.');
        }

        // Validate project
        let project = task.getInput('project', true);

        // Validate buildDefinitionId
        let buildDefinitionId = task.getInput('buildDefinitionId', true);
        let definitionId = Number(buildDefinitionId);
        if (Number.isNaN(definitionId)) {
            throw new Error('Build Definition Id must be a numerical value');
        }

        let artifactName = task.getInput('artifactName', true);

        // Validate targetDirectory
        let targetDirectory = task.getInput('targetDirectory', false);
        task.mkdirP(targetDirectory);

        let accountUri = task.getVariable('System.TeamFoundationCollectionUri');

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
        task.debug('buildsOptions=' + JSON.stringify(buildsOptions));

        console.log('Requesting build artifact \'' + artifactName + '\'...')

        await rpn(buildsOptions)
            .then(function (builds: any) {
                let build = builds.value[0];

                if (!build) {
                    task.debug('no build found');
                    return null;
                }

                return build.id;
            })
            .catch(function (err) {
                throw new Error('Could not find project \'' + project + '\'. Make sure that the project exists.');
            })
            .then(function (buildId) {
                task.debug('buildId=' + buildId);
                if (!buildId) {
                    throw new Error('Could not find a completed successful build. Ensure that build definition \'' + definitionId + '\' has a successful build.');
                }

                task.debug('found build ' + buildId);

                let buildArtifactUri = projectUri + '/_apis/build/builds/' + buildId + '/artifacts';
                task.debug('buildArtifactUri=' + buildArtifactUri);

                var buildArtifactOptions = getRequestOptions({ uri: buildArtifactUri });
                task.debug('buildArtifactOptions=' + JSON.stringify(buildArtifactOptions));

                task.debug('requesting build details');
                return rpn(buildArtifactOptions);
            })
            .then(function (results: any) {
                if (results.count === '0') {
                    throw new Error('Could not find build details');
                }

                let artifacts: any[] = results.value;
                task.debug('artifacts: ' + JSON.stringify(artifacts));

                task.debug('filtering artifacts for ' + artifactName);
                let artifact = artifacts.find(a => a.name === artifactName);
                task.debug('artifact=' + JSON.stringify(artifact));

                if (!artifact) {
                    throw new Error('Could not find build artifact \'' + artifactName + '\'. Ensure the build definition publishes an artifact named \'' + artifactName + '\'');
                }

                console.log('Found build artifact');

                return artifact;
            })
            .then(function (artifact: any) {
                // File share
                if (artifact.resource.type == 'FilePath') {
                    task.debug('artifact type: File share')
                    let artifactSourcePath = path.join(artifact.resource.data, artifactName);
                    task.debug('artifact source path: ' + artifactSourcePath);
                    task.debug('artifact target path: ' + targetDirectory)
                    console.log('Copying build artifact from ' + artifactSourcePath + '...');
                    task.cp(artifactSourcePath, targetDirectory, '-rf', false);
                    console.log('Copying completed');

                    return { isZip: false }
                }
                // Server
                else {
                    task.debug('artifact type: Server');
                    let artifactUri: string = artifact.resource.downloadUrl;
                    task.debug('artifactUri=' + artifactUri);

                    let artifactPath = path.join(targetDirectory, artifactName + '.zip');
                    task.debug('artifactPath=' + artifactPath);

                    var downloadOptions = getRequestOptions({ uri: artifactUri });
                    task.debug('downloadOptions=' + JSON.stringify(downloadOptions));

                    return new Promise(function (resolve, reject) {

                        console.log('Downloading build artifact \'' + artifactName + '\'...');

                        request(artifactUri, downloadOptions)
                            .on('error', function (err) {
                                task.debug('download failed');
                                task.debug(err.message);
                                reject('Could not download build artifact from ' + artifactUri);
                            })
                            .pipe(fs.createWriteStream(artifactPath))
                            .on('error', function (err) {
                                task.debug('download failed');
                                task.debug(err.message);
                                reject('Could not download build artifact from ' + artifactUri);
                            })
                            .on('finish', function () {
                                console.log('Download completed');
                                resolve({ isZip: true, artifactPath: artifactPath });
                            });
                    });
                }

            })
            .then(function (artifact: { isZip: boolean, artifactPath: string }) {
                if (!artifact.isZip) {
                    task.debug('artifact not zip file');
                    task.debug('skipping zip extraction');
                }
                else {
                    console.log('Extracting ' + artifact.artifactPath + ' to ' + path.join(targetDirectory, artifactName) + '...');
                    let zip = new admZip(artifact.artifactPath);
                    zip.extractAllTo(targetDirectory, true);
                    console.log('Extraction completed');
                }
            });

    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();