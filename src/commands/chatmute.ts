import { Message } from 'discord.js'

import Moderator from '../models/moderator'
import PunishManager from '../managers/PunishManager'

import * as Util from '../utils/util'
import * as config from '../config'

import { ModAction } from '../utils/db'
import { default as Command, CommandParams } from '../structures/Command'

export default class ChatMuteCommand extends Command {
  get cOptions() {
    return { suppressArgs: true, allowedRoles: config.access.commands.chatmute }
  }

  async execute(
    message: Message,
    args: string[],
    { guild, member }: CommandParams
  ) {
    const sendError = (content: string) => {
      const embed = { color: config.meta.defaultColor, description: content }
      message.channel
        .send({ embed })
        .then(msg => msg.delete({ timeout: config.ticks.errMsgDeletion }))
        .catch(() => {})
    }

    if (!config.meta.modRoles.some(id => member.roles.cache.has(id))) {
      const limits = {
        [config.ids.roles.legendarySponsor]: {
          time: 2.592e9,
          count: 10
        }
      }

      const limit = (Object.entries(limits).find(l => {
        return member.roles.cache.has(l[0])
      }) || [])[1]
      if (limit) {
        const actionType = config.modActionTypes.MEMBER_MUTE
        const actions = await ModAction.filter(a => {
          return (
            a.executorID === message.author.id &&
            a.type === actionType &&
            (a.tick as number) <= Date.now() - limit.time
          )
        })
        if (actions.length + 1 > limit.count) return

        ModAction.insertOne({
          executorID: message.author.id,
          type: actionType,
          tick: Date.now()
        })
      }
    }

    const targetMember = await Util.resolveMember(args.shift() || '', guild)
    if (!targetMember) {
      sendError('Участник не найден')
      return
    }
    if (targetMember.id === message.author.id) {
      sendError('Нельзя замутить себя')
      return
    }

    const duration = Util.msConvert(args.shift())
    if (typeof duration !== 'number') {
      sendError('Укажите длительность наказания')
      return
    }

    const reason = args.join(' ')
    if (reason.length < 1) {
      sendError('Укажите причину')
      return
    }

    if (config.meta.modRoles.some(id => member.roles.cache.has(id))) {
      Moderator.getOne({ user_id: message.author.id }).then(mod => {
        mod.mute_count += 1
        mod.score += 0.2
        mod.save()
      })
    }

    PunishManager.chatmute({
      userID: targetMember.id,
      guildID: guild.id,
      moderID: message.author.id,
      duration,
      reason
    })

    // PunishManager.request({
    //   message: {
    //     embed: {
    //       color: config.meta.defaultColor,
    //       title: `Выдача ChatMute | ${message.author.tag}`,
    //       description: `**Причина**\n> ${reason}`,
    //       fields: [
    //         { name: 'Пользователь', value: String(targetMember), inline: true },
    //         {
    //           name: 'Время наказания',
    //           value:
    //             typeof duration === 'number'
    //               ? Util.parseFilteredTimeArray(duration, {
    //                   nouns: config.meta.pluralTime
    //                 }).join(' ')
    //               : 'Навсегда',
    //           inline: true
    //         }
    //       ]
    //     }
    //   },
    //   userID: targetMember.id,
    //   guildID: guild.id,
    //   moderID: message.author.id,
    //   duration,
    //   reason,
    //   type: config.ids.punishments.chatmute
    // })
  }
}
