import { Module } from '@nestjs/common';
import { ZTTeamTTSService } from './tts.service';

@Module({
  providers: [ZTTeamTTSService],
  exports: [ZTTeamTTSService],
})
export class ZTTeamAudioModule {}
