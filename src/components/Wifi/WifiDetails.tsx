import React, { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../store/hooks';

import './wifiDetails.css';

export const WifiDetails = (): JSX.Element => {
  const { wifiStatus, networkConfig } = useAppSelector((state) => state.wifi);

  return (
    <div className="main-layout content-center">
      <div className="wifi-detail-wrapper">
        <div className="wifi-item">
          <div>network:</div>
          <div>{wifiStatus?.connection_name}</div>
        </div>
        <div className="wifi-item">
          <div>hostname:</div>
          <div>{wifiStatus?.hostname}</div>
        </div>
        <div className="wifi-item ip-item">
          <div>ips:</div>
          <div>
            {(wifiStatus?.ips || []).map((ip) => (
              <div className="ip-value">{ip}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
