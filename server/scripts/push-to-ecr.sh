# NOTE: The script will try to create the ECR repository if it doesn't exist. Please grant the necessary permissions to the IAM user or role.
# Usage:
#    cd server/scripts
#    bash ./push-to-ecr.sh

set -o errexit  # exit on first error
set -o nounset  # exit on using unset variables
set -o pipefail # exit on any error in a pipeline

# Check prerequisites
echo "================================================"
echo "SwiftChat - Build and Push to ECR"
echo "================================================"
echo ""

echo "Checking prerequisites..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ ERROR: Docker is not installed or not in PATH."
    echo "Please install Docker Desktop or Docker Engine before running this script."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ ERROR: Docker daemon is not running."
    echo "Please start Docker Desktop or Docker daemon before running this script."
    exit 1
fi

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "❌ ERROR: AWS CLI is not installed or not in PATH."
    echo "Please install AWS CLI before running this script."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ ERROR: AWS credentials are not configured."
    echo "Please run 'aws configure' or set up your AWS credentials before running this script."
    exit 1
fi

echo "✅ All prerequisites are met."
echo ""

# Prompt user for inputs

# Get repository name
read -p "Enter ECR repository name (default: swift-chat-api): " REPO_NAME
REPO_NAME=${REPO_NAME:-swift-chat-api}

# Get image tag
read -p "Enter image tag (default: latest): " TAG
TAG=${TAG:-latest}

# Get AWS region
read -p "Enter AWS region (default: us-east-1): " AWS_REGION
AWS_REGION=${AWS_REGION:-us-east-1}

# Get deployment type
echo ""
echo "Select deployment type:"
echo "  1) AppRunner (default) - uses amd64 architecture"
echo "  2) Lambda - uses arm64 architecture"
read -p "Enter deployment type (1 or 2, default: 1): " DEPLOY_TYPE
DEPLOY_TYPE=${DEPLOY_TYPE:-1}

# Determine architecture based on deployment type
case $DEPLOY_TYPE in
    1)
        DEPLOY_TYPE_NAME="AppRunner"
        ARCH="amd64"
        ;;
    2)
        DEPLOY_TYPE_NAME="Lambda"
        ARCH="arm64"
        ;;
    *)
        echo "❌ ERROR: Invalid deployment type. Please enter 1 or 2."
        exit 1
        ;;
esac

echo ""
echo "Configuration:"
echo "  Repository: $REPO_NAME"
echo "  Image Tag: $TAG"
echo "  AWS Region: $AWS_REGION"
echo "  Deployment Type: $DEPLOY_TYPE_NAME"
echo "  Architecture: $ARCH"
echo ""
read -p "Continue with these settings? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi
echo ""

# Acknowledgment about ECR repository creation
echo "ℹ️  NOTICE: This script will automatically create ECR repository if it doesn't exist."
echo "   The repository will be created with the following default settings:"
echo "   - Image tag mutability: MUTABLE (allows overwriting tags)"
echo "   - Image scanning: Disabled"
echo "   - Encryption: AES256 (AWS managed encryption)"
echo ""
echo "   You can modify these settings later in the AWS ECR Console if needed."
echo "   Required IAM permissions: ecr:CreateRepository, ecr:GetAuthorizationToken,"
echo "   ecr:BatchCheckLayerAvailability, ecr:InitiateLayerUpload, ecr:UploadLayerPart,"
echo "   ecr:CompleteLayerUpload, ecr:PutImage, ecr-public:GetAuthorizationToken"
echo ""
read -p "Do you acknowledge and want to proceed? (y/n): " ACK_CONFIRM
if [[ ! "$ACK_CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi
echo ""

build_and_push_image() {
    local IMAGE_NAME=$1
    local TAG=$2
    local DOCKERFILE_PATH=$3
    local BUILD_ARCH=$4
    local REGION=$AWS_REGION

    echo "Logging in to AWS Public ECR..."
    # Log in to AWS Public ECR for pulling base images
    if ! aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws; then
        echo "❌ ERROR: Failed to login to AWS Public ECR. Please check your AWS credentials."
        exit 1
    fi

    echo "Building $IMAGE_NAME:$TAG for linux/$BUILD_ARCH..."

    # Build Docker image
    if ! docker buildx build --platform linux/$BUILD_ARCH -t $IMAGE_NAME:$TAG -f $DOCKERFILE_PATH --load ../src/; then
        echo "❌ ERROR: Failed to build Docker image."
        exit 1
    fi

    echo "Getting AWS account ID..."
    # Get the account ID
    if ! ACCOUNT_ID=$(aws sts get-caller-identity --region $REGION --query Account --output text 2>/dev/null); then
        echo "❌ ERROR: Failed to get AWS account ID. Please check your AWS credentials and region."
        exit 1
    fi

    # Create repository URI
    REPOSITORY_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}"

    echo "Creating ECR repository if it doesn't exist..."
    # Create ECR repository if it doesn't exist
    aws ecr create-repository --repository-name "${IMAGE_NAME}" --region $REGION >/dev/null 2>&1 || true

    echo "Logging in to ECR..."
    # Log in to ECR
    if ! aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REPOSITORY_URI; then
        echo "❌ ERROR: Failed to login to ECR. Please check your AWS credentials and permissions."
        exit 1
    fi

    echo "Tagging image for ECR..."
    # Tag the image for ECR
    if ! docker tag $IMAGE_NAME:$TAG $REPOSITORY_URI:$TAG; then
        echo "❌ ERROR: Failed to tag Docker image."
        exit 1
    fi

    echo "Pushing image to ECR..."
    # Push the image to ECR
    if ! docker push $REPOSITORY_URI:$TAG; then
        echo "❌ ERROR: Failed to push image to ECR."
        exit 1
    fi

    echo "✅ Successfully pushed $IMAGE_NAME:$TAG to $REPOSITORY_URI"
    echo ""

    # Return the image URI for later use
    echo "$REPOSITORY_URI:$TAG"
}

echo "Building and pushing SwiftChat image..."
IMAGE_URI=$(build_and_push_image "$REPO_NAME" "$TAG" "../src/Dockerfile" "$ARCH")

echo "================================================"
echo "✅ Image successfully pushed!"
echo "================================================"
echo ""
echo "Your container image URI:"
echo "  $IMAGE_URI"
echo ""
echo "Next steps:"
echo "  1. Download the CloudFormation templates from server/template/ folder"
echo "  2. Update the ContainerImageUri parameter with your image URI above"
echo "  3. Deploy the stack via AWS CloudFormation Console"
echo ""
