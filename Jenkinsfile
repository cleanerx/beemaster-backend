pipeline {
    agent { label 'android' }
    
    environment {
        CLOUDFLARE_API_TOKEN = credentials('cloudflare-api-token')
        INTERNAL_API_KEY = credentials('beemaster-internal-key')
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
                    npm ci
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
                    npm run test:unit -- --reporter=verbose
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
                    npm run test:integration -- --reporter=verbose
                '''
            }
        }
        
        stage('Security Tests') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
                    npm run test:unit -- tests/unit/auth.test.ts --reporter=verbose
                    npm run test:integration -- tests/integration/security.test.ts --reporter=verbose
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
        }
        
        stage('Publish Coverage') {
            steps {
                script {
                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }
        
        stage('Set Secrets') {
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
                    
                    echo "Setting INTERNAL_API_KEY..."
                    echo "$INTERNAL_API_KEY" | npx wrangler secret put INTERNAL_API_KEY
                    
                    echo "Setting GOOGLE_PLAY_SERVICE_ACCOUNT..."
                    echo "$GOOGLE_PLAY_SERVICE_ACCOUNT" | npx wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT
                    
                    echo "Setting PLAY_INTEGRITY_SERVICE_ACCOUNT..."
                    echo "$PLAY_INTEGRITY_SERVICE_ACCOUNT" | npx wrangler secret put PLAY_INTEGRITY_SERVICE_ACCOUNT
                    
                    echo "Setting LITELLM_MASTER_KEY..."
                    echo "$LITELLM_MASTER_KEY" | npx wrangler secret put LITELLM_MASTER_KEY
                    
                    echo "Setting ADMIN_API_KEY..."
                    echo "$ADMIN_API_KEY" | npx wrangler secret put ADMIN_API_KEY
                '''
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