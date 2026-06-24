import http from 'node:http';

const port = Number(process.env.PORT || 8080);

const settings = {
  enable_sounds: true,
  disable_ui_features: false,
  timezone_sync: 'auto',
  time_zone: 'America/Los_Angeles',
  reverse_scrolling: {
    home: false,
    keyboard: false
  }
};

const radio = {
  wifi: true,
  bluetooth: true
};

const labState = {
  motor_power: 0,
  band_heater_power: 0,
  motor_mode: 'up',
  running: false
};

const readJson = async (req) =>
  new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });

const send = (res, status, body) => {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  });
  res.end(status === 204 ? undefined : JSON.stringify(body));
};

const handleSettings = async (req, res) => {
  if (req.method === 'GET') {
    send(res, 200, settings);
    return;
  }

  Object.assign(settings, await readJson(req));
  send(res, 200, settings);
};

const handleLabControl = async (req, res) => {
  Object.assign(labState, await readJson(req), { running: true });
  send(res, 200, labState);
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;
  console.log(`${req.method} ${path}`);

  try {
    if (path === '/api/v1/machine') {
      send(res, 200, {
        serial: 'LOCAL-LAB-TEST',
        firmware: 'mock',
        image_version: '26Mlocal-lab_certification',
        image_build_channel: 'lab_certification',
        image_build_date: new Date().toUTCString(),
        repository_info: {}
      });
      return;
    }

    if (path === '/api/v1/machine/OS_update_status') {
      send(res, 200, { status: 'IDLE', progress: 0, info: '' });
      return;
    }

    if (path === '/api/v1/settings/' || path === '/api/v1/settings') {
      await handleSettings(req, res);
      return;
    }

    if (path.includes('/profile')) {
      send(res, 200, path.includes('last') ? { profile_id: null } : []);
      return;
    }

    if (path === '/api/v1/wifi/radio') {
      if (req.method !== 'GET') {
        const body = await readJson(req);
        radio.wifi = Boolean(body.enable);
      }
      send(res, 200, { enabled: radio.wifi });
      return;
    }

    if (path === '/api/v1/bluetooth/status') {
      send(res, 200, {
        powered: radio.bluetooth,
        connected_devices: []
      });
      return;
    }

    if (path === '/api/v1/bluetooth/power') {
      const body = await readJson(req);
      radio.bluetooth = body.state === 'on';
      send(res, 200, {
        current_state: {
          powered: radio.bluetooth,
          connected_devices: []
        }
      });
      return;
    }

    if (path === '/api/v1/lab/motor-heater') {
      if (req.method === 'GET') {
        send(res, 200, labState);
        return;
      }
      await handleLabControl(req, res);
      return;
    }

    if (path === '/api/v1/lab/motor-heater/stop') {
      labState.running = false;
      send(res, 200, labState);
      return;
    }

    send(res, 200, {});
  } catch (error) {
    console.error(error);
    send(res, 500, { error: 'mock_backend_error' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock dial backend listening on http://127.0.0.1:${port}`);
});
