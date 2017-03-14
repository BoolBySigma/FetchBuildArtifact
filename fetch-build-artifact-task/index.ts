import * as task from 'vsts-task-lib/task';
import * as process from 'process';
import * as request from 'request';
import * as requestPromise from 'request-promise';
import * as path from 'path';
import * as fs from 'fs';
import * as unzip from 'unzip';

function stringIsNullOrEmpty(val: string): boolean {
    if (val === undefined || val === null || val.trim() === '') {
        return true;
    }
    return false;
};

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

        let authHeader = {
            'Authorization': {
                'Bearer': process.env['SYSTEM_ACCESSTOKEN']
            }
        };

        let buildsUri = projectUri + '/_apis/build/builds';
        task.debug('buildsUri=' + buildsUri);

        var buildsOptions = {
            uri: buildsUri,
            auth: {
                'bearer': process.env['SYSTEM_ACCESSTOKEN']
            },
            qs: {
                definitions: definitionId,
                statusFilter: 'completed',
                resultFilter: 'succeeded',
                $top: 1,
                'api-version': '2.0'
            },
            headers: authHeader,
            json: true
        };
        task.debug('buildsOption:');
        task.debug(JSON.stringify(buildsOptions));

        console.log('Querying completed successful builds of build definition\'' + definitionId + '\'');

        await requestPromise(buildsOptions)
            .then(function (builds: any) {
                let build = builds.value[0];

                if (!build) {
                    task.debug('build not found')
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

                var buildArtifactOptions = {
                    uri: buildArtifactUri,
                    auth: {
                        'bearer': process.env['SYSTEM_ACCESSTOKEN']
                    },
                    qs: {
                        'api-version': '2.0'
                    },
                    headers: authHeader,
                    json: true
                };
                task.debug('buildArtifactOptions:');
                task.debug(JSON.stringify(buildArtifactOptions));

                console.log('Querying build artifact \'' + artifactName + '\'');
                return requestPromise(buildArtifactOptions);
            })
            .then(function(results: any){
                if (results.count === '0'){
                    throw new Error('Could not find build');
                }

                let artifacts: any[] = results.value;

                let artifact = artifacts.find(a => a.name === artifactName);

                if (!artifact){
                    throw new Error('Could not find build artifact \'' + artifactName + '\'');
                }

                console.log('Found build artifact \'' + artifactName + '\'');
                let artifactUri: string = artifact.resource.downloadUrl;

                return artifactUri;
            })
            .then(function (artifactUri: string) {
                let artifactPath = path.join(targetDirectory, artifactName + '.zip');

                console.log('Downloading build artifact\'' + artifactName + '\' to ' + artifactPath);
                
                var buildArtifactFileOptions = {
                    uri: artifactPath,
                    auth: {
                        'bearer': process.env['SYSTEM_ACCESSTOKEN']
                    },
                    qs: {
                        'api-version': '2.0'
                    },
                    headers: authHeader,
                    json: true
                };

                request(artifactUri, buildArtifactFileOptions).pipe(fs.createWriteStream(artifactPath))
                
                fs.createReadStream(artifactPath).pipe(unzip.Extract({ path: path.join(targetDirectory, artifactName) }));
            })
            .then(function(results: any){
                console.log('Done');
            });

    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();