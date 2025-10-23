import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    TagType,
    TagSection,
    ContentRating,
    Request,
    Response,
    Tag,
    LanguageCode
} from "paperback-extensions-common"
// @ts-ignore
import { parseSearch, parseViewMore, decodeHTMLEntity, convertTime } from "./GenericMangaParser"

/**
 * ==============================
 * CONFIGURATION SECTION
 * ==============================
 */
const CONFIG = {
    DOMAIN: 'https://baotangtruyen36.top/',          // 👉 đổi domain ở đây
    API_BASE: 'https://api.chilltruyentranh.site/',     // 👉 nếu site có API riêng
    SOURCE_NAME: 'BaoTangTruyenTranh',
    AUTHOR: 'Dowin',
    AUTHOR_SITE: 'https://github.com/luonlu',
    DESCRIPTION: 'bao_tang_truyen_tranh',
    CONTENT_RATING: ContentRating.MATURE
}

/**
 * ==============================
 * SOURCE INFO
 * ==============================
 */
export const GenericMangaInfo: SourceInfo = {
    version: '1.0.0',
    name: CONFIG.SOURCE_NAME,
    icon: 'icon.png',
    author: CONFIG.AUTHOR,
    authorWebsite: CONFIG.AUTHOR_SITE,
    description: CONFIG.DESCRIPTION,
    websiteBaseURL: CONFIG.DOMAIN,
    contentRating: CONFIG.CONTENT_RATING,
    sourceTags: [{ text: "Template", type: TagType.BLUE }]
}

/**
 * ==============================
 * MAIN SOURCE CLASS
 * ==============================
 */
export class GenericManga extends Source {
    getMangaShareUrl(mangaId: string): string { return mangaId.split("::")[0] }

    requestManager = createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request): Promise<Request> => {
                // @ts-ignore
                request.headers = {
                    ...(request.headers ?? {}),
                    referer: CONFIG.DOMAIN,
                    'user-agent': 'Mozilla/5.0 (compatible; PaperbackTemplate/1.0)'
                }
                return request
            },
            interceptResponse: async (response: Response): Promise<Response> => response
        }
    })

    /**
     * ==============================
     * 1️⃣ Get Manga Details
     * ==============================
     */
    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({ url: mangaId.split("::")[0], method: "GET" })
        const data = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(data.data)

        const title = $('.title > h1').text().trim()
        const author = $('.author').text().trim()
        const image = $('.photo img').attr('src') ?? ''
        const desc = $('.description .content').text().trim()
        const status = $('.status').text().includes('Đang') ? 1 : 0

        const tags: Tag[] = []
        $('.category a').each((_: any, e: any) => {
            const label = $(e).text().trim()
            const id = $(e).attr('href') ?? label
            tags.push(createTag({ label, id }))
        })

        return createManga({
            id: mangaId,
            author,
            artist: author,
            desc: decodeHTMLEntity(desc),
            titles: [decodeHTMLEntity(title)],
            image: encodeURI(image),
            status,
            hentai: false,
            tags: [createTagSection({ label: "Genres", tags, id: '0' })]
        })
    }

    /**
     * ==============================
     * 2️⃣ Get Chapters
     * ==============================
     */
    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${CONFIG.API_BASE}/comic/${mangaId.split("::")[1]}/chapter?offset=0&limit=-1`,
            method: "GET"
        })
        const data = await this.requestManager.schedule(request, 1)
        const json = typeof data.data === 'string' ? JSON.parse(data.data) : data.data

        return json.result.chapters.map((obj: any) =>
            createChapter({
                id: `${mangaId.split('::')[0]}/chuong-${obj.numberChapter}`,
                chapNum: parseFloat(obj.numberChapter),
                name: obj.name,
                mangaId,
                langCode: LanguageCode.VIETNAMESE,
                time: convertTime(obj.stringUpdateTime)
            })
        )
    }

    /**
     * ==============================
     * 3️⃣ Get Chapter Details (Images)
     * ==============================
     */
    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({ url: chapterId, method: "GET" })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)

        const pages: string[] = []
        $('.viewer img').each((_: any, e: any) => {
            const link = $(e).attr('src') || $(e).attr('data-src')
            if (link) pages.push(encodeURI(link))
        })

        return createChapterDetails({
            id: chapterId,
            mangaId,
            pages,
            longStrip: false
        })
    }

    /**
     * ==============================
     * 4️⃣ Home Sections
     * ==============================
     */
    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            { id: 'hot', title: 'Truyện đề xuất', path: '/comic/search/view' },
            { id: 'new_updated', title: 'Cập nhật gần đây', path: '/comic/search/recent' },
            { id: 'new_added', title: 'Truyện mới', path: '/comic/search/new' }
        ]

        for (const s of sections) {
            const sec = createHomeSection({ id: s.id, title: s.title, view_more: true })
            sectionCallback(sec)

            const req = createRequestObject({ url: `${CONFIG.API_BASE}${s.path}?p=0`, method: "GET" })
            const data = await this.requestManager.schedule(req, 1)
            const json = typeof data.data === 'string' ? JSON.parse(data.data) : data.data
            sec.items = parseViewMore(json).slice(0, 10)
            sectionCallback(sec)
        }
    }

    /**
     * ==============================
     * 5️⃣ View More (Pagination)
     * ==============================
     */
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 0
        const pathMap: any = {
            hot: '/comic/search/view',
            new_updated: '/comic/search/recent',
            new_added: '/comic/search/new'
        }
        const path = pathMap[homepageSectionId]
        if (!path) return createPagedResults({ results: [] })

        const req = createRequestObject({ url: `${CONFIG.API_BASE}${path}?p=${page}`, method: "GET" })
        const data = await this.requestManager.schedule(req, 1)
        const json = typeof data.data === 'string' ? JSON.parse(data.data) : data.data

        return createPagedResults({
            results: parseViewMore(json),
            metadata: { page: page + 1 }
        })
    }

    /**
     * ==============================
     * 6️⃣ Search
     * ==============================
     */
    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 0
        const tags = query.includedTags?.map(tag => tag.id) ?? []

        const url = query.title
            ? `${CONFIG.API_BASE}/comic/search?name=${encodeURIComponent(query.title)}`
            : `${CONFIG.API_BASE}/comic/search/category?p=${page}&value=${tags[0]}`

        const request = createRequestObject({ url, method: "GET" })
        const data = await this.requestManager.schedule(request, 1)
        const json = typeof data.data === 'string' ? JSON.parse(data.data) : data.data

        return createPagedResults({
            results: parseSearch(json),
            metadata: query.title ? undefined : { page: page + 1 }
        })
    }

    /**
     * ==============================
     * 7️⃣ Tags
     * ==============================
     */
    async getSearchTags(): Promise<TagSection[]> {
        const request = createRequestObject({ url: `${CONFIG.API_BASE}/category`, method: "GET" })
        const data = await this.requestManager.schedule(request, 1)
        const json = typeof data.data === 'string' ? JSON.parse(data.data) : data.data

        const tags: Tag[] = json.result.map((t: any) => createTag({ id: t.id, label: t.name }))
        return [createTagSection({ id: '0', label: 'Thể loại', tags })]
    }
}
