const exec = require('child_process').exec
const fs = require('fs')

const systemdTemplate = require('./systemd')
const initdTemplate = require('./initd')

const ctlOptions = {
  mode: 493 // rwxr-xr-x
}

function hasSystemD () {
  return fs.existsSync('/usr/lib/systemd/system') || fs.existsSync('/bin/systemctl')
}

function hasSystemV () {
  return fs.existsSync('/etc/init.d')
}

function deleteSystemD (name, callback) {
  const filepath = `/etc/systemd/system/${name}.service`
  console.log(`Removing service on: ${filepath}`)
  fs.exists(filepath, exists => {
    if (exists) {
      fs.unlink(filepath, err => {
        if (err) {
          callback(err)
          return
        }

        let cmd = 'systemctl daemon-reload'
        console.log('Running %s...', cmd)
        exec(cmd, err => {
          callback(err, 'SystemD service registered succesfully')
        })
      })
    } else {
      callback(`Service doesn't exists, nothing to uninstall`)
    }
  })
}

function setupSystemD (name, options, callback) {
  const filepath = `/etc/systemd/system/${name}.service`
  console.log(`Installing service on: ${filepath}`)
  fs.exists(filepath, exists => {
    if(!exists) {
      const script = systemdTemplate(options)
      fs.writeFile(filepath,script, err => {
        if (err) {
          callback(err)
          return
        }

        fs.chmod(filepath,'755', err => {
          if (err) {
            callback(err)
            return
          }
          
          let cmd = 'systemctl daemon-reload'
          console.log('Running %s...', cmd)
          exec(cmd, err => {
            callback(err, 'SystemD service registered succesfully')
          })
        })
      })
    } else {
      callback('Service already exists, please uninstall first')
    }
  })
}

function setupSystemV (name, options, callback) {
  fs.writeFileSync(
   `/etc/init.d/${name}`, 
   initdTemplate(options), 
   ctlOptions
  )
  child_process.execSync('chkconfig', ['--add', name])
  child_process.execSync('update-rc.d', [name, 'defaults'])
  callback(null, 'init.d service registered succesfully')
}

module.exports.add = function (name, options, callback) {
  options.name = name
  options.pidFile = options.pidFile || `/var/run/${name}.pid`

  options.deepstreamExec = options.deepstreamExec || '/usr/bin/deepstream'
  options.errOut = options.errOut || 'null'
  options.stdOut = options.stdOut || 'null'
  options.user = options.user || 'root'
  options.group = options.group || 'root'

  if (options && !options.runLevels) {
  	options.runLevels = [2, 3, 4, 5].join(' ')
  } else {
    options.runLevels = options.runLevels.join(' ')
  }

  options.deepstreamArgs = options.programArgs.join(' ')

  if (hasSystemD()) {
    setupSystemD(name, options, callback)
  } else if (hasSystemV()) {
  	setupSystemV(name, options, callback)
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

module.exports.remove = function (name, callback) {
  if (hasSystemD()) {
    deleteSystemD(name, callback)
  } else if (hasSystemV()) {
    deleteSystemV(name, callback)
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}