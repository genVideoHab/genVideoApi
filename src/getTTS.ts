import { v4 as uuidv4 } from 'uuid'

export enum TTSAudioModel {
  P_1 = 'zh_female_tiexinnvsheng_mars_bigtts',
  P_2 = 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts',
  P_3 = 'zh_female_cancan_mars_bigtts',
  P_4 = 'en_female_anna_mars_bigtts',
  P_5 = 'en_male_dryw_mars_bigtts',
  P_6 = 'en_male_smith_mars_bigtts',
  P_7 = 'en_male_jackson_mars_bigtts',
  P_8 = 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts',
  P_9 = 'zh_male_jieshuonansheng_mars_bigtts',
  P_10 = 'zh_female_tiexinnvsheng_mars_bigtts',
}


const BASR_URL = 'https://openspeech.bytedance.com/api/v1/tts'

const config = {
  app: {
    appid: '7974140052',
    token: `1CBFSmw-aT5nt1_WCEvdykCTny7tLkHd`,
    cluster: 'volcano_tts',
  },
  user: {
    uid: uuidv4(),
  },
  audio: {
    voice_type: TTSAudioModel.P_8,
    encoding: 'mp3',
    speed_ratio: 1.25,
  },
  request: {
    reqid: uuidv4(),
    text: '',
    operation: 'query',
  },
}

enum TTSCode {
  Success = 3000,
  Failed = 3001,
}

interface TTSResponse {
  reqid: string
  code: number
  operation: string
  message: string
  sequence: number
  data: string // base64 encoded audio data
  addition: {
    duration: string
  }
}

export async function getTTS({
  text,
  audioModel,
  speedRatio,
}: {
  text: string
  audioModel?: TTSAudioModel
  speedRatio?: number
}): Promise<TTSResponse> {
  // 设置请求文本
  config.request.text = text

  if (audioModel) {
    config.audio.voice_type = audioModel
  }

  if (speedRatio) {
    config.audio.speed_ratio = speedRatio
  }

  const response = await fetch(BASR_URL, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer;${config.app.token}`,
    },
    method: 'POST',
    body: JSON.stringify(config),
  })
  const data = (await response.json()) as TTSResponse

  if (data.code !== TTSCode.Success) {
    throw new Error(`TTS failed: ${JSON.stringify(data)}`)
  }

  return data
}
