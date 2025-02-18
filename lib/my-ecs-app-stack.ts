import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as path from 'path';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class MyEcsAppStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Define custom names
        const clusterName = 'db_demo_cluster';
        const repositoryName = 'database_demo_repo';
        const taskDefinitionName = 'db_demo_task';
        const containerName = 'db_demo_container';

        // Add global tags to all resources
        cdk.Tags.of(this).add('Project', 'DB_DEMO');
        cdk.Tags.of(this).add('Environment', 'Production');
        cdk.Tags.of(this).add('Owner', 'Gabriel');

        // Create a VPC
        const vpc = new ec2.Vpc(this, 'MyVpc', { maxAzs: 2 });

        // Create an ECR Repository
        const repository = new ecr.Repository(this, 'MyEcrRepo', { repositoryName });

        // Create an ECS Cluster
        const cluster = new ecs.Cluster(this, 'MyCluster', { vpc, clusterName });

        // Create a Docker Image Asset
        const asset = new ecr_assets.DockerImageAsset(this, 'MyNodeAppImage', {
            directory: path.join(__dirname, '../app')
        });

        // Define a Fargate Task Definition
        const taskDefinition = new ecs.FargateTaskDefinition(this, 'MyTaskDef', {
            memoryLimitMiB: 512,
            cpu: 256
        });

        // Add a container to the task definition
        const container = taskDefinition.addContainer(containerName, {
            image: ecs.ContainerImage.fromDockerImageAsset(asset),
            memoryLimitMiB: 512,
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'ecs' })
        });

        container.addPortMappings({ containerPort: 80 });

        // // Create a Fargate Service with a Load Balancer
        // new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'MyFargateService', {
        //     cluster,
        //     taskDefinition,
        //     desiredCount: 1,
        //     publicLoadBalancer: true
        // });
        
        // Create a Fargate service
        const service = new ecs.FargateService(this, 'MyFargateService', {
            cluster: cluster,
            taskDefinition: taskDefinition,
            desiredCount: 1
        });
    
        // Create an Application Load Balancer
        const lb = new elbv2.ApplicationLoadBalancer(this, 'MyALB', {
            vpc: vpc,
            internetFacing: true
        });
    
        // Add a listener to the load balancer
        const listener = lb.addListener('MyListener', {
            port: 80
        });
    
        // Add the Fargate service as a target to the listener
        listener.addTargets('MyTarget', {
            port: 80,
            targets: [service]
        });
    
        // Output the load balancer DNS name
        new cdk.CfnOutput(this, 'LoadBalancerDNS', {
            value: lb.loadBalancerDnsName
        });

        // Output the created resources
        new cdk.CfnOutput(this, 'TaskDefinitionArn', {
            value: taskDefinition.taskDefinitionArn,
            description: 'ECS Task Definition ARN',
          });
        new cdk.CfnOutput(this, 'EcrRepoUri', { value: repository.repositoryUri, description: 'ECR Repository URI' });
        new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName, description: 'ECS Cluster Name' });
        new cdk.CfnOutput(this, 'TaskDefinitionName', { value: taskDefinition.family, description: 'Task Definition Name' });
        new cdk.CfnOutput(this, 'ContainerName', { value: container.containerName, description: 'Container Name' });
    }
}