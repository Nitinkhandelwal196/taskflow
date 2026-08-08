pipeline {
  agent any

  environment {
    DOCKERHUB_CREDS = credentials('dockerhub-creds')       // Jenkins credential ID
    DOCKERHUB_USER  = 'YOUR_DOCKERHUB_USERNAME'
    GIT_CREDS       = credentials('github-creds')          // for pushing to GitOps repo
    GITOPS_REPO     = 'https://github.com/YOUR_USERNAME/taskflow-gitops.git'
    SONAR_HOST_URL  = 'http://sonarqube:9000'               // your SonarQube server
    IMAGE_TAG       = "${env.BUILD_NUMBER}"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Backend: Install & Test') {
      steps {
        dir('backend') {
          sh 'npm ci'
          sh 'npm test'
        }
      }
    }

    stage('SonarQube Analysis') {
      steps {
        withSonarQubeEnv('sonarqube-server') {
          sh '''
            sonar-scanner \
              -Dsonar.projectKey=taskflow \
              -Dsonar.sources=backend/src,frontend/src \
              -Dsonar.host.url=$SONAR_HOST_URL
          '''
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    stage('OWASP Dependency-Check') {
      steps {
        dir('backend') {
          dependencyCheck additionalArguments: '--scan . --format HTML --format XML',
                           odcInstallation: 'owasp-dc'
        }
        dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
      }
    }

    stage('Build Docker Images') {
      steps {
        sh "docker build -t $DOCKERHUB_USER/taskflow-backend:$IMAGE_TAG ./backend"
        sh "docker build -t $DOCKERHUB_USER/taskflow-frontend:$IMAGE_TAG ./frontend"
      }
    }

    stage('Trivy Scan') {
      steps {
        sh "trivy image --severity HIGH,CRITICAL --exit-code 0 --format table $DOCKERHUB_USER/taskflow-backend:$IMAGE_TAG"
        sh "trivy image --severity HIGH,CRITICAL --exit-code 0 --format table $DOCKERHUB_USER/taskflow-frontend:$IMAGE_TAG"
        // Set --exit-code 1 once you're ready to hard-fail the pipeline on critical CVEs
      }
    }

    stage('Push to Docker Hub') {
      steps {
        sh 'echo $DOCKERHUB_CREDS_PSW | docker login -u $DOCKERHUB_CREDS_USR --password-stdin'
        sh "docker push $DOCKERHUB_USER/taskflow-backend:$IMAGE_TAG"
        sh "docker push $DOCKERHUB_USER/taskflow-frontend:$IMAGE_TAG"
      }
    }

    stage('Update GitOps Repo') {
      steps {
        sh '''
          rm -rf gitops-repo
          git clone https://$GIT_CREDS_USR:$GIT_CREDS_PSW@${GITOPS_REPO#https://} gitops-repo
          cd gitops-repo
          yq -i ".spec.template.spec.containers[0].image = \\"$DOCKERHUB_USER/taskflow-backend:$IMAGE_TAG\\"" k8s/30-backend.yaml
          yq -i ".spec.template.spec.containers[0].image = \\"$DOCKERHUB_USER/taskflow-frontend:$IMAGE_TAG\\"" k8s/40-frontend.yaml
          git config user.email "jenkins@ci.local"
          git config user.name "jenkins-ci"
          git commit -am "ci: bump image tags to $IMAGE_TAG" || echo "no changes"
          git push
        '''
        // ArgoCD (auto-sync enabled) picks up this commit and deploys to EKS
      }
    }
  }

  post {
    always {
      sh 'docker logout || true'
    }
  }
}
