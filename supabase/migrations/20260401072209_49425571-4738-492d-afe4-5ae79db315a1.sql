UPDATE lots
SET image_urls = (
  SELECT COALESCE(array_agg(url), '{}')
  FROM unnest(image_urls) AS url
  WHERE url LIKE 'https://bid.candtauctions.co.uk/images/lot/%'
)
WHERE source = 'CandT'
  AND array_length(image_urls, 1) > 0;