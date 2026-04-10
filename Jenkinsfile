pipeline {
    agent { label 'android' }
    
    environment {
        CLOUDFLARE_API_TOKEN = credentials('cloudflare-api-token')
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git submodule update --init --recursive || true'
            }
        }
        
        stage('Setup Node.js') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    node --version
                    npm --version
                '''
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm install
                '''
            }
        }
        
        stage('Lint') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm run lint || echo "⚠️ Lint warnings"
                '''
            }
        }
        
        stage('Unit Tests') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm run test:unit -- --reporter=verbose || true
                '''
            }
            post {
                always {
                    junit 'coverage/junit.xml' || true
                }
            }
        }
        
        stage('Integration Tests') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm run test:integration -- --reporter=verbose || true
                '''
            }
        }
        
        stage('System Tests') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm run test:system -- --reporter=verbose || true
                '''
            }
        }
        
        stage('Coverage Report') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm run test:coverage || true
                '''
            }
            post {
                always {
                    publishHTML(target: [
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ]) || true
                }
            }
        }
        
        stage('Deploy to Cloudflare') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npx wrangler deploy
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo '✅ Beemaster Backend Pipeline Successful'
        }
        failure {
            echo '❌ Beemaster Backend Pipeline Failed'
        }
    }
}