'use strict';
const aws = require('aws-sdk');
const __ = require('lodash');
const uuid = require('uuid');
const stepfunctions = new aws.StepFunctions();
const contextUtil = require('acn-pricing-sls-common').contextUtil;
const CALC_ACTIVITY_ARN = process.env.CALC_ACTIVITY_ARN;
const STATEMACHINE_SAMPLE_ORCH_ARN = process.env.STATEMACHINE_SAMPLE_ORCH_ARN;

//TODO: organize mini state machines to call as big workflow
// TODO: organize serveless.yml file to be more manageable

module.exports.configureFlow = (event, context, callback) =>{
    var result = {};
    console.log('event', event);
    var request = contextUtil.prepareRequest(event, context);
    console.log('request', request);

    var configuration = {};
    if (request && request.type === 'A') {
        configuration = {runPreReqFlow: true, runRandom: false}
    }
    else if (request && request.type === 'B') {
        configuration = {runPreReqFlow: true, runRandom: true};
    }

    result.configuration = configuration;
    result.requestId = request.requestId;

    callback(null, result);
};

module.exports.activityWatcher = (event, context, callback) =>{
    console.log('event In', JSON.stringify(event));
    var request = contextUtil.prepareRequest(event, context);
    console.log('request', request);
    console.log('reqeust.isObject', __.isObject(request));

    var requestId = __.get(request, 'requestId') || request.requestId;
    var taskToken = __.get(request, 'taskToken') || request.taskToken;
    console.log('requestID', requestId);
    console.log('TaskToken', taskToken);

    var response = {};
    var successParams = {
        output: 'true',
        taskToken: taskToken
    };

    return stepfunctions.sendTaskSuccess(successParams, function(err, data) {
        if (err) {
            response = {
                statusCode: 500,
                body: JSON.stringify(err + requestId)
            }
        } else {
            response = {
                statusCode: 200,
                body: JSON.stringify({result: {requestId: requestId}})
            }
        }

    });

    // TODO: Call Step function success or failure
    callback(null, null);
};

module.exports.initiateCalc = (event, context, callback) =>{

    console.log('event', JSON.stringify(event));
    var request = contextUtil.prepareRequest(event, context);
    console.log('request', request);

    var requestId = __.get(request, 'requestId');

    var taskParams = {
        activityArn: CALC_ACTIVITY_ARN,
        workerName: requestId
    };

    // TODO: Standardize response sending
    stepfunctions.getActivityTask(taskParams, function (err, data) {
        var response;

        if (err) {
            console.log('Err getting token', err);
            response = err;
        }
        else {
            console.log('Task token data', data);
            console.log('requestId', requestId);
            response =  {requestId: requestId, token: data.taskToken};

        }
        callback(null, response);
    });

};

module.exports.invokeStateMachines = (event, context, callback) =>{
    var executions = __.get(event, 'executions');
    console.log('invokeStepFunction, event in', event);
    console.log('executions', executions);

    var promises = [];
    __.each(executions, function(e) {
        var params = {
            stateMachineArn: STATEMACHINE_SAMPLE_ORCH_ARN + '-n02KKx60Fj3V',
            input: JSON.stringify(e),
            name: __.get(e, 'requestId') || uuid()
        };
        console.log('Starting execution for params', params);

        promises.push(stepfunctions.startExecution(params).promise());
    });

    return Promise.all(promises)
        .then(result => {
            console.log('In result', result);
            callback(null, result);
        },
        err => {
            console.log('In err', err);
            callback(null, err);
        });

};


