module.exports = {
  apps: [
    {
      name: 'catalogo',
      cwd: '/opt/catalogo',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3015
      },
      error_file: '/opt/catalogo/logs/error.log',
      out_file: '/opt/catalogo/logs/out.log',
      time: true
    }
  ]
};
