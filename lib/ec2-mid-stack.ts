import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3Assets from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';

export class MidServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'MidServerVpc', {
      maxAzs: 2,
    });

    // Create an IAM role for the instance
    const role = new iam.Role(this, 'MidServerRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')); // Enables SSM access
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite')); // Allows reading secrets

    // Define EC2 instance
    const instance = new ec2.Instance(this, 'MidServerInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // Ensure it's in a public subnet
      associatePublicIpAddress: true, // Assign a public IP
      role,
    });

    // Import the script as an asset
    const scriptAsset = new s3Assets.Asset(this, 'MidServerScript', {
      path: 'assets/install_mid_server.sh',
    });

    // Allow EC2 to download the script from S3
    scriptAsset.grantRead(instance.role);

    // User Data: Download and execute the script
    instance.addUserData(
      `aws s3 cp ${scriptAsset.s3ObjectUrl} /tmp/install_mid_server.sh`,
      `chmod +x /tmp/install_mid_server.sh`,
      `sudo /tmp/install_mid_server.sh`
    );

    // Output the public IP of the instance
    // new cdk.CfnOutput(this, 'InstancePublicIp', {
    //   value: instance.instancePublicIp,
    // });
  }
}