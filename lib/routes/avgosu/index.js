const got = require('@/utils/got');
const cheerio = require('cheerio');
const linkUrl = 'https://avgosu.com';
const host = `https://avgosu.com/torrent/vod.html`;
//发送请求
module.exports = async (ctx) => {
    const response = await got({
        method: 'get',
        url: host,
    });
    //获取页面数据
    const data = response.data;
    const $ = cheerio.load(data);
    const list = $('#fboardlist .list-row')
        .slice(0, 20)
        .map(function () {
            const info = {
                //获取文章标题
                title: $(this).find('h2 a').text(),
                //获取文章链接
                link: $(this).find('h2 a').attr('href'),
                //获取文章发布日期
                date: $(this).find('div.list-details.text-muted.ellipsis span').text(),
            };
            return info;
        })
        .get();

    const out = await Promise.all(
        list.map(async (info) => {
            const hosturl = linkUrl;
            const title = info.title;
            //const date = info.date;
            const itemUrl = info.link;

            const cache = await ctx.cache.get(itemUrl);
            if (cache) {
                return Promise.resolve(JSON.parse(cache));
            }
            //获取文章详细内容
            const response = await got.get(itemUrl);

            const $ = cheerio.load(response.data);


           
            //获取文章图片
            // const postweb = $("div.view-img");
            // const description = postweb.find('img');
            // const images = postweb.find('img');

            const description = info.title;
            //获取torrent文件链接地址
            const torrent = $("a.btn.btn-torrent").attr('href');

            const enclosure_url = hosturl + torrent;
            const single = {
                title,
                link: itemUrl,
                description,
                enclosure_url,
                enclosure_type: 'application/x-bittorrent'
            };
            if (description !== 'undefind') {
                ctx.cache.set(itemUrl, JSON.stringify(single));
            }
            return Promise.resolve(single);
        })
    );


    ctx.state.data = {
        title: `韩国三级`,
        link: host,
        item: out,
    };

}
