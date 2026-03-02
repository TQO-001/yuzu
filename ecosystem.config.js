// WM-01: PM2 Cluster Mode configuration.
//
// WHY CLUSTER MODE?
//   Node.js is single-threaded. Cluster mode spawns one worker per CPU
//   core, allowing the app to handle multiple concurrent requests.
//   `pm2 reload` performs a zero-downtime restart — workers are replaced
//   one at a time, so the app never goes offline during deployment.

module.exports = {
  apps: [
    {
      name:      'schema-documenter',
      script:    'node_modules/.bin/next',
      args:      'start',
      cwd:       '/var/www/schema-documenter',

      instances:  'max',        // One worker per CPU core
      exec_mode:  'cluster',    // Enable Node.js cluster mode

      watch:       false,       // Do not restart on file changes in production
      max_memory_restart: '500M',

      env_production: {
        NODE_ENV: 'production',
        PORT:     3000,
      },

      // Log file locations (viewable with: pm2 logs)
      error_file: '/var/log/pm2/schema-documenter-error.log',
      out_file:   '/var/log/pm2/schema-documenter-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
