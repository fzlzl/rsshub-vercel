const got = require('@/utils/got');
const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');
const { art } = require('@/utils/render');
const path = require('path');

module.exports = async (ctx) => {
    const isWestern = /^\/western/.test(ctx.path);

    const rootUrl = `https://www.${ctx.query.domain ?? 'javbus.com'}`;
    const westernUrl = `https://www.${ctx.query.western_domain ?? 'javbus.red'}`;
    const currentUrl = `${isWestern ? westernUrl : rootUrl}${ctx.path.replace(/^\/western/, '').replace(/\/home/, '')}`;

    const response = await got({
        method: 'get',
        url: currentUrl,
    });

    const $ = cheerio.load(response.data);

    let items = $('.movie-box')
        .slice(0, ctx.query.limit ? parseInt(ctx.query.limit) : 30)
        .toArray()
        .map((item) => {
            item = $(item);

            return {
                link: item.attr('href'),
                guid: item.find('date').first().text(),
                pubDate: parseDate(item.find('date').last().text()),
            };
        });

    items = await Promise.all(
        items.map((item) =>
            ctx.cache.tryGet(item.link, async () => {
                const detailResponse = await got({
                    method: 'get',
                    url: item.link,
                });

                const content = cheerio.load(detailResponse.data);

                content('.genre').last().parent().remove();
                content('input[type="checkbox"], button').remove();

                const stars = content('.avatar-box span')
                    .toArray()
                    .map((s) => content(s).text());

                const cache = {
                    author: stars.join(', '),
                    title: content('h3').text(),
                    category: content('.genre label')
                        .toArray()
                        .map((c) => content(c).text())
                        .concat(stars),
                    info: content('.row.movie').html(),
                    thumbs: content('.sample-box')
                        .toArray()
                        .map((i) => {
                            const thumbSrc = content(i).attr('href');
                            return /^http/.test(thumbSrc) ? thumbSrc : `${rootUrl}${thumbSrc}`;
                        }),
                };

                let magnets, videoSrc, videoPreview;

                // To fetch magnets.

                try {
                    const matches = detailResponse.data.match(/var gid = (\d+);[\s\S]*var uc = (\d+);[\s\S]*var img = '(.*)';/);

                    const magnetResponse = await got({
                        method: 'get',
                        url: `${rootUrl}/ajax/uncledatoolsbyajax.php`,
                        searchParams: {
                            gid: matches[1],
                            lang: 'zh',
                            img: matches[3],
                            uc: matches[2],
                            floor: 800,
                        },
                        headers: {
                            Referer: item.link,
                        },
                    });

                    const content = cheerio.load(`<table>${magnetResponse.data}</table>`);

                    magnets = content('tr')
                        .toArray()
                        .map((tr) => {
                            const td = content(tr).find('a[href]');
                            const ma = content(tr).find('a.btn.btn-mini-new.disabled');

                            return {
                                title: td.first().text().trim(),
                                link: td.first().attr('href'),
                                size: td.eq(1).text().trim(),
                                date: td.last().text().trim(),
                                gaoqing: content(tr).find('a.btn-primary').text().trim(),
                                sub: content(tr).find('a.btn-warning').text().trim(),
                                lablelength: ma.length,
                            };
                        });

                    // if (magnets) {
                    //     item.enclosure_url = magnets[0].link;
                    //     item.enclosure_type = 'application/x-bittorrent';
                    // }
                    const magurl = [];
                    const magsuburl=[];
                    //筛选有字幕和高清标签的磁力
                    suburl = magnets.map(obj => {
                        if (obj.lablelength > 1) {
                            return obj.size;
                        }
                    });
                    //去除数组 suburl[] 中的undefined
                    for (let i = 0; i < suburl.length; i++) {
                        if (suburl[i] === undefined) {
                            suburl.splice(i, 1);
                            i = i - 1;          // i - 1 ,因为空元素在数组下标 2 位置，删除空之后，后面的元素要向前补位
                        }
                    }
                    //给数组 suburl[] 排序
                    for (let i = 0; i < suburl.length - 1; i++) {
                        for (let j = 0; j < suburl.length - i; j++) {
                            if (parseFloat(suburl[j]) < parseFloat(suburl[j + 1])) {
                                let temp = suburl[j];
                                suburl[j] = suburl[j + 1];
                                suburl[j + 1] = temp;
                            }
                        }
                    }
                    
                    //根据排序完的 suburl[] 数组的最大值获取对应的磁力
                    
                    for (let i = 0; i < magnets.length; i++){
                        if (magnets[i].size === suburl[0]) {                           
                            magsuburl.push(magnets[i].link);
                        }
                    }
                    // console.log(magsuburl);
                    //筛选有高清标签的磁力
                    gaoqingurl = magnets.map(obj => {
                        if (obj.gaoqing === "高清") {
                            return obj.size;
                        }
                    });
                    
                    //去除数组 gaoqingurl[] 中的undefined
                    for (let i = 0; i < gaoqingurl.length; i++) {
                        if (gaoqingurl[i] === undefined) {
                            gaoqingurl.splice(i, 1);
                            i = i - 1;          // i - 1 ,因为空元素在数组下标 2 位置，删除空之后，后面的元素要向前补位
                        }
                    }
                    
                    //给数组 gaoqingurl[] 排序
                    for (let i = 0; i < gaoqingurl.length - 1; i++) {
                        for (let j = 0; j < gaoqingurl.length - i; j++) {
                            if ( parseFloat(gaoqingurl[j]) < parseFloat(gaoqingurl[j + 1])) {
                                let temp = gaoqingurl[j];
                                gaoqingurl[j] = gaoqingurl[j + 1];
                                gaoqingurl[j + 1] = temp;
                            }
                        }
                    }
                    
                    //根据排序完的 gaoqingurl[] 数组的最大值获取对应的磁力
                    
                    for (let i = 0; i < magnets.length; i++){
                        if (magnets[i].size === gaoqingurl[0]) {                           
                            magurl.push(magnets[i].link);
                        }
                    }
                    
                    if (magsuburl.length>0) {
                        //判断是否有字幕和高清标签的磁力
                        item.enclosure_url = magsuburl[0];
                    } else if (magurl.length>0) {
                        //判断是否为高清标签的磁力
                        item.enclosure_url = magurl[0];
                    };
                     item.enclosure_type = 'application/x-bittorrent';
                } catch (e) {
                    // no-empty
                }

                // If the video is not western, go fetch preview.

                if (!isWestern) {
                    try {
                        const avgleResponse = await got({
                            method: 'get',
                            url: `https://api.avgle.com/v1/jav/${item.guid}/0`,
                        });

                        // full video
                        videoSrc = avgleResponse.data.response.videos[0]?.embedded_url ?? '';
                        // video preview
                        videoPreview = avgleResponse.data.response.videos[0]?.preview_video_url ?? '';
                    } catch (e) {
                        // no-empty
                    }
                }

                item.author = cache.author;
                item.title = cache.title;
                item.category = cache.category;
                item.description = art(path.join(__dirname, 'templates/description.art'), {
                    info: cache.info,
                    thumbs: cache.thumbs,
                    magnets,
                    videoSrc,
                    videoPreview,
                });

                return item;
            })
        )
    );

    const title = $('head title').text();

    ctx.state.data = {
        title: `${/^JavBus/.test(title) ? '' : 'JavBus - '}${title.replace(/ - AV磁力連結分享/, '')}`,
        link: currentUrl,
        item: items,
    };
};
