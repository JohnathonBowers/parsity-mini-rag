# Chunking Strategy

## Articles

For chunking the HTML articles, it will be important to filter out the markup and isolate the content. A lot of the relevant content will be inside <p> tags, but there may be other content we want to grab, too, like the title of the article and the date it was published. A library like Beautiful Soup or Cheerio could be useful for all of this.

## LinkedIn Posts

The LinkedIn posts seem more straightforward to extract text from, since all of the posts are stored in the "text" column in the CSV file. We can use a CSV parsing library like Papa Parse for this.