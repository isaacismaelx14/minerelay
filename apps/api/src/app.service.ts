import { Injectable } from '@nestjs/common';
import { getApiMetadata } from './app-metadata';

type BaseInfoResponse = {
  service: string;
  packageName: string;
  version: string;
  status: 'ok';
};

@Injectable()
export class AppService {
  getBaseInfo(): BaseInfoResponse {
    const metadata = getApiMetadata();
    return {
      service: 'api',
      packageName: metadata.name,
      version: metadata.version,
      status: 'ok',
    };
  }
}
