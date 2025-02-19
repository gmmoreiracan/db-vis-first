#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyEcsAppStack } from '../lib/my-ecs-app-stack';
import { MidServerStack } from '../lib/ec2-mid-stack';

const app = new cdk.App();
new MyEcsAppStack(app, 'MyEcsAppStack');
new MidServerStack(app, 'MidServerStack');