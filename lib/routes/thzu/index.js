const got = require('@/utils/got');
const cheerio = require('cheerio');
const linkUrl = 'http://71thz.com/';
const host = `${linkUrl}forum.php?mod=forumdisplay&fid=181&filter=typeid&typeid=770`;
//发送请求
module.exports = async (ctx) => {
    const response = await got({
        method: 'get',
        url: host,
    });
    //获取页面数据
    const data = response.data;
    const $ = cheerio.load(data);
    const list = $('#threadlisttableid tbody[id^=normalthread]')
        .slice(0, 25)
        .map(function () {
            const info = {
                //获取文章标题
                title: '[' + $(this).find('th em a').text() + '] ' + $(this).find('a.s.xst').text(),
                //获取文章链接
                link: $(this).find('a.s.xst').attr('href'),
                //获取文章发布日期
                date: $(this).find('td.by').find('em span span').attr('title'),
            };
            return info;
        })
        .get();

    const out = await Promise.all(
        list.map(async (info) => {
            const hosturl = linkUrl;
            const title = info.title;
            const date = info.date;
            const itemUrl = hosturl + info.link;

            const cache = await ctx.cache.get(itemUrl);
            if (cache) {
                return Promise.resolve(JSON.parse(cache));
            }
            //获取文章详细内容
            const response = await got.get(itemUrl);

            const $ = cheerio.load(response.data);
            const postweb = $("td[id^='postmessage']");
            //获取文章图片
            const images = postweb.find('img');
            for (let k = 0; k < images.length; k++) {
                if (!$(images[k]).attr('file') || $(images[k]).attr('file') === 'undefined') {
                    $(images[k]).replaceWith('');
                } else {
                    $(images[k]).replaceWith(`<img src="${$(images[k]).attr('file')}" />`);
                }
            }
            const description = (postweb.html() || '抓取原帖失败').replace(/ignore_js_op/g, 'div');

            //获取torrent文件链接地址
            const torrent = $("p.attnm").find('a[href^=imc_attachad-ad\\.html\\?aid\\=]:not([href$=nothumb\\=yes])').attr('href');
            //替换torrent文件链接为下载链接地址
            const torrenturl = torrent.replace("imc_attachad-ad.html?", "forum.php?mod=attachment&");

            const enclosure_url = hosturl + torrenturl;
            const single = {
                title,
                link: itemUrl,
                description,
                pubDate: new Date(date).toUTCString(),
                enclosure_url,
                enclosure_type: 'application/x-bittorrent'
            };
            if (description !== '抓取原帖失败') {
                ctx.cache.set(itemUrl, JSON.stringify(single));
            }
            return Promise.resolve(single);
        })
    );


    ctx.state.data = {
        title: `桃花族`,
        link: linkUrl,
        item: out,
    };

}
