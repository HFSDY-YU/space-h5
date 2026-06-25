import { showConfirmDialog } from 'vant'
import { isCapacityOverflow } from '@/services/spaceMapper'

interface CapacityRoom {
  code: string
  name: string
  capacityMax?: number | null
}

/**
 * 提交前处理人数超额：未超额直接放行；超额时弹确认框。
 * 返回 capacityOverrideConfirmed 的取值（false=未超额，true=用户确认超额提交）；
 * 用户取消时返回 null，调用方据此中止提交。
 */
export async function resolveCapacityOverride(
  peopleCount: number,
  room: CapacityRoom,
): Promise<boolean | null> {
  if (!isCapacityOverflow(peopleCount, room.capacityMax)) {
    return false
  }

  try {
    await showConfirmDialog({
      title: '人数超过房间容量',
      message: `预约人数 ${peopleCount} 人超过 ${room.code} ${room.name} 最大容量 ${room.capacityMax} 人，是否仍然提交？`,
      confirmButtonText: '仍然提交',
    })
    return true
  } catch {
    return null
  }
}
