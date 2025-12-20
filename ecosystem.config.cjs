module.exports = {
  apps: [
    {
      name: 'aurelinportal-prod',
      script: './server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'prod',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      error_file: './logs/pm2-prod-error.log',
      out_file: './logs/pm2-prod-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
