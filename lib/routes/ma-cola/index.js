const got = require('@/utils/got');
const cheerio = require('cheerio');
// const linkUrl = 'https://madouqu.com/';

const host = `https://madouqu.com/tag/cola%e9%85%b1/`;


//发送请求
module.exports = async (ctx) => {
    const response = await got({
        method: 'get',
        url: host,
    });
    //获取页面数据
    const data = response.data;
    const $ = cheerio.load(data);
    // console.log(data);
    const list = $('.row.posts-wrapper div.col-lg-1-5.col-6.col-sm-6.col-md-4.col-lg-3')
        .slice(0, 10)
        .map(function () {
            const info = {
                //获取文章标题
                title: $(this).find('h2 a').text(),
                //获取文章链接
                link: $(this).find('h2 a').attr('href'),
                //获取文章发布日期
                date: $(this).find('li.meta-date #time').text(),
            };
            return info;
        })
        .get();
    // console.log(list);
    const out = await Promise.all(
        list.map(async (info) => {
            // const hosturl = linkUrl;
            const title = info.title;
            const date = info.date;
            const itemUrl = info.link;

            const cache = await ctx.cache.get(itemUrl);
            if (cache) {
                return Promise.resolve(JSON.parse(cache));
            }
            //获取文章详细内容
            const response = await got.get(itemUrl);

            const $ = cheerio.load(response.data);
            
            const tags = $('div.entry-tags a[rel=tag]').text();
            //console.log(tags);
            const description = tags;

            //获取torrent文件链接地址
            const magnet = $("a:contains(Magnet)").attr('href');
            // console.log(magnet);

            // 判断磁力是否完整
            if (magnet !== null && magnet !== undefined) {
                if (magnet.startsWith('magnet')) {
                    enclosure_url = magnet;
                } else {
                    enclosure_url = "magnet:?xt=urn:btih:" + magnet;
                }
            } else {
                enclosure_url = "";
            }          
            // const isMag = magnet.startsWith('magnet');
            // if (isMag) {
            //      enclosure_url = magnet;
            // } else {
            //      enclosure_url = "magnet:?xt=urn:btih:" + magnet;
            // }
            const single = {
                title,
                link: itemUrl,
                pubDate: new Date(date).toUTCString(),
                enclosure_url,
                enclosure_type: 'application/x-bittorrent'
            };
            return Promise.resolve(single);
        })
    );


    ctx.state.data = {
        title: `麻豆区`,
        link: host,
        item: out,
    };

}
