// @ts-ignore
import { MangaTile, createMangaTile, createIconText } from "paperback-extensions-common"

export const parseSearch = (json: any): MangaTile[] => {
    return json.result.comics.map((obj: any) =>
        createMangaTile({
            id: `${obj.url}::${obj.id}`,
            image: obj.thumbUrl,
            title: createIconText({ text: obj.name }),
            subtitleText: createIconText({ text: obj.lastChapter?.name ?? "" })
        })
    )
}

export const parseViewMore = (json: any): MangaTile[] => parseSearch(json)

export const decodeHTMLEntity = (str: string): string => {
    if (!str) return ''
    return str.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
}

export const convertTime = (timeAgo: string): Date => {
    const now = new Date()
    const num = parseInt(timeAgo)
    if (timeAgo.includes('phút')) now.setMinutes(now.getMinutes() - num)
    else if (timeAgo.includes('giờ')) now.setHours(now.getHours() - num)
    else if (timeAgo.includes('ngày')) now.setDate(now.getDate() - num)
    else if (timeAgo.includes('tháng')) now.setMonth(now.getMonth() - num)
    else if (timeAgo.includes('năm')) now.setFullYear(now.getFullYear() - num)
    return now
}
