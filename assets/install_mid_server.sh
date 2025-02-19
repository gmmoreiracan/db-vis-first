#!/bin/bash

# Exit on any error
set -e

# Log file
LOG_FILE="/var/log/midserver_install.log"
exec > >(tee -a $LOG_FILE) 2>&1

# Check if MID Server is already installed
if [ ! -f "/opt/servicenow/agent/agent.jar" ]; then
  echo "MID Server not installed. Proceeding with installation..."

  # Create non-root user if it doesn't exist
  NONROOT_USER="midserver"
  if ! id "$NONROOT_USER" &>/dev/null; then
    sudo useradd -m -s /bin/bash $NONROOT_USER
    echo "$NONROOT_USER ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/$NONROOT_USER
  fi

  # Fetch credentials from AWS Secrets Manager
  CREDENTIALS=$(aws secretsmanager get-secret-value --secret-id MidServerCredentials --query SecretString --output text --region ca-central-1)
  MID_USER=$(echo $CREDENTIALS | jq -r .username)
  MID_PASSWORD=$(echo $CREDENTIALS | jq -r .password)

  # Download and install MID Server RPM if not already installed
  if [ ! -d "/opt/servicenow/agent" ]; then
    cd /opt
    wget -O midserver.rpm "https://install.service-now.com/glide/distribution/builds/package/app-signed/mid-linux-installer/2024/12/02/mid-linux-installer.xanadu-07-02-2024__patch4-11-22-2024_12-02-2024_1408.linux.x86-64.rpm"
    sudo rpm -ivh --nodeps midserver.rpm --prefix=/opt/servicenow
  fi

  # Run MID Server installer
  sudo -u $NONROOT_USER /opt/servicenow/agent/installer.sh -silent \
    -INSTANCE_URL https://dev195254.service-now.com \
    -MUTUAL_AUTH N \
    -MID_USERNAME $MID_USER \
    -MID_PASSWORD $MID_PASSWORD \
    -USE_PROXY N \
    -MID_NAME mid \
    -APP_NAME mid \
    -APP_LONG_NAME ServiceNow_MID_Server_Mid \
    -NON_ROOT_USER $NONROOT_USER

  # Enable and start MID Server service
  sudo /opt/servicenow/agent/start.sh

else
  echo "MID Server is already installed. Skipping installation."
fi