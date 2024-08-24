const axios = require('axios');
const cheerio = require('cheerio');

async function scrape(url) {
    const { data } = await axios.get(url); 
    const $ = cheerio.load(data);

    const fullName = $('h1').text().trim() || $('div.NameTitle__Name-dowf0z-0').text().trim();
    const ratingValue = $('.RatingValue__Numerator-qw8sqy-2.liyUjw').text();
    const department = $('a.TeacherDepartment__StyledDepartmentLink-fl79e8-0.iMmVHb').text().replace('department', '').trim();

    const comments = [];
    $('div.Comments__StyledComments-dzzyvm-0.gRjWel').each((index, element) => {
        const comment = $(element).text().trim();
        comments.push(comment);
    });

    return {
        'professor': fullName,
        'star_rating': ratingValue,
        'subject': department,
        'reviews': comments
    };
}

module.exports = scrape;
