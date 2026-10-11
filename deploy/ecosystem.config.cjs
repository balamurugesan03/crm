// PM2 process file:  pm2 start deploy/ecosystem.config.cjs --env production
// Socket.IO rooms and the in-process automation/scheduler run in one process, so keep instances = 1
// (scale vertically; multi-instance needs a Socket.IO Redis adapter and a single scheduler).
module.exports = {
  apps: [
    {
      name: 'nexuscrm-api',
      cwd: '/var/www/nexuscrm/server',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '700M',
      kill_timeout: 12000,
      env_production: { NODE_ENV: 'production' },
      out_file: '/var/log/nexuscrm/out.log',
      error_file: '/var/log/nexuscrm/error.log',
      time: true,
    },
  ],
};
