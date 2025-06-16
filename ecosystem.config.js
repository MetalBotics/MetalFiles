module.exports = {
  apps: [
    {
      name: 'filetransfer',
      script: 'npm',
      args: 'start',
      cwd: '/home/ubuntu/filetransfer',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 28126,
        FORCE_HTTPS: 'true',
        NEXT_PUBLIC_FORCE_HTTPS: 'true',
        NEXT_PUBLIC_DOMAIN: 'metalfiles.tech',
        NEXT_PUBLIC_PROTOCOL: 'https'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 28126,
        FORCE_HTTPS: 'true',
        NEXT_PUBLIC_FORCE_HTTPS: 'true',
        NEXT_PUBLIC_DOMAIN: 'metalfiles.tech',
        NEXT_PUBLIC_PROTOCOL: 'https'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      // Restart delay if app crashes
      restart_delay: 4000,
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      // Maximum number of restarts
      max_restarts: 10,
      // Minimum uptime before restart
      min_uptime: '10s'
    }
  ]
};
