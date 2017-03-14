import * as task from 'vsts-task-lib/task';
import * as process from 'process';
import * as https from 'https';

import * as request from 'request';
import * as requestPromise from 'request-promise';

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

        //let buildPath = '/' + project + '/_apis/build/builds?definitions=' + definitionId + '&statusFilter=completed&resultFilter=succeeded&$top=1&api-version=2.0';

        var buildsOptions = {
            uri: buildsUri,
            qs: {
                definitions: definitionId,
                statusFilter: 'completed',
                resultFilter: 'succeeded',
                top: 1,
                'api-version': '2.0'
            },
            headers: authHeader,
            json: true
        };

        await requestPromise(buildsOptions)
            .then(function (build) {
                console.log(build);
            })
            .catch(function (err) {
                console.log(err);
            });


        /*var options = {
            host: 'bool1sandbox.visualstudio.com',
            path: buildPath,
            headers: authHeader,
            method: 'GET'
        };

        await getBuilds(options).catch((error) => {
            console.log(error);
        }).then((buildId) => {
            console.log('build id:');
            console.log(buildId);
        });*/
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

async function getBuilds(options: object) {
    return get(options).then((body: any) => {
        return body.value.id;
    })
}

async function get(options: object) {
    return new Promise((resolve, reject) => {
        const request = https.get(options, (response) => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error('Failed to load page, status code: ' + response.statusCode));
            }
            const body = [];
            response.on('data', (chunk) => body.push(chunk));
            response.on('end', () => resolve(body.join('')));
        });
        request.on('error', (err) => reject(err))
    })
}

run();