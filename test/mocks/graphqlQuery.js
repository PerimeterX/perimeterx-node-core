// https://perimeterx.atlassian.net/wiki/spaces/CON/pages/3385098248/GraphQL+Effort+as+part+of+API+visibility?src=search#Trulia
module.exports = {
    largeGraphqlObject: {
        query: 'query SiteInfo {\n' +
            '  siteInfo {\n' +
            '    phone {\n' +
            '      isOpen\n' +
            '      number\n' +
            '      weekdayHours {\n' +
            '        ...HoursFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      weekendHours {\n' +
            '        ...HoursFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      exceptions {\n' +
            '        ...ExceptionsFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    chat {\n' +
            '      isOpen\n' +
            '      weekdayHours {\n' +
            '        ...HoursFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      weekendHours {\n' +
            '        ...HoursFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      exceptions {\n' +
            '        ...ExceptionsFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    dataLayer {\n' +
            '      keys {\n' +
            '        usabilla {\n' +
            '          feedbackButtonId\n' +
            '          campaignIds {\n' +
            '            inlineSearchResultsYes\n' +
            '            inlineSearchResultsNo\n' +
            '            __typename\n' +
            '          }\n' +
            '          __typename\n' +
            '        }\n' +
            '        googleMapsApi\n' +
            '        googlePlacesApi\n' +
            '        dynamicYieldKey\n' +
            '        salesForce\n' +
            '        cartographerApiKeys\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    globalContent {\n' +
            '      top {\n' +
            '        id\n' +
            '        content\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    navigation {\n' +
            '      id\n' +
            '      name\n' +
            '      url\n' +
            '      image {\n' +
            '        ...ImageFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      subCategories(limit: 6) {\n' +
            '        id\n' +
            '        name\n' +
            '        url\n' +
            '        image {\n' +
            '          ...ImageFields\n' +
            '          __typename\n' +
            '        }\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    __typename\n' +
            '  }\n' +
            '}\n' +
            'fragment HoursFields on Hours {\n' +
            '  startTime\n' +
            '  endTime\n' +
            '  __typename\n' +
            '}\n' +
            'fragment ExceptionsFields on HoursException {\n' +
            '  date\n' +
            '  fullDayClosure\n' +
            '  adjustedHours {\n' +
            '    ...HoursFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  __typename\n' +
            '}\n' +
            'fragment ImageFields on Image {\n' +
            '  id\n' +
            '  imageType\n' +
            '  description\n' +
            '  __typename\n' +
            '}\n',
    },

    largeGraphqlObject2: {
        query: 'query CategoryBrowsePageContent($categoryId: Int!) {\n' +
            '  sharedCategoryPromos(id: $categoryId) {\n' +
            '    ...CommonPromoFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  categoryContent(id: $categoryId) {\n' +
            '    ... on CategoryPageContent {\n' +
            '      ...CategoryPageFields\n' +
            '      __typename\n' +
            '    }\n' +
            '    __typename\n' +
            '  }\n' +
            '}\n' +
            'fragment CommonPromoFields on ContentPromo {\n' +
            '  id\n' +
            '  priority\n' +
            '  variation\n' +
            '  action {\n' +
            '    __typename\n' +
            '    ... on Link {\n' +
            '      name\n' +
            '      url\n' +
            '      __typename\n' +
            '    }\n' +
            '    ... on VideoLink {\n' +
            '      name\n' +
            '      video {\n' +
            '        ...VideoFields\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '  }\n' +
            '  couponCode\n' +
            '  expirationDate\n' +
            '  headline\n' +
            '  subHeading\n' +
            '  image {\n' +
            '    id\n' +
            '    __typename\n' +
            '  }\n' +
            '  imageOverlay {\n' +
            '    id\n' +
            '    __typename\n' +
            '  }\n' +
            '  trackingCode\n' +
            '  __typename\n' +
            '}\n' +
            'fragment VideoFields on Video {\n' +
            '  id\n' +
            '  description\n' +
            '  screenshotId\n' +
            '  streamProviderCode\n' +
            '  hashKey\n' +
            '  title\n' +
            '  __typename\n' +
            '}\n' +
            'fragment CategoryPageFields on CategoryPageContent {\n' +
            '  __typename\n' +
            '  id\n' +
            '  brandCopy\n' +
            '  brands {\n' +
            '    ...BrandContentFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  categories {\n' +
            '    ...ContentGroupsFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  articles {\n' +
            '    ...ArticleContentFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  videos {\n' +
            '    ...VideoFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  seoText\n' +
            '  general {\n' +
            '    __typename\n' +
            '    ... on ContentRichText {\n' +
            '      value\n' +
            '      __typename\n' +
            '    }\n' +
            '    ... on GeneralGroupContent {\n' +
            '      items {\n' +
            '        ... on GeneralImageItem {\n' +
            '          image {\n' +
            '            ...ImageFields\n' +
            '            __typename\n' +
            '          }\n' +
            '          title\n' +
            '          url\n' +
            '          __typename\n' +
            '        }\n' +
            '        ... on GeneralVideoItem {\n' +
            '          video {\n' +
            '            ...VideoFields\n' +
            '            __typename\n' +
            '          }\n' +
            '          title\n' +
            '          __typename\n' +
            '        }\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    ... on ContentCallToAction {\n' +
            '      name\n' +
            '      url\n' +
            '      __typename\n' +
            '    }\n' +
            '  }\n' +
            '}\n' +
            'fragment BrandContentFields on CategoryCard {\n' +
            '  __typename\n' +
            '  id\n' +
            '  image {\n' +
            '    ...ImageFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  url\n' +
            '  name\n' +
            '  trackingCode\n' +
            '  type\n' +
            '}\n' +
            'fragment ImageFields on Image {\n' +
            '  id\n' +
            '  imageType\n' +
            '  description\n' +
            '  __typename\n' +
            '}\n' +
            'fragment ContentGroupsFields on ContentGroups {\n' +
            '  title\n' +
            '  items {\n' +
            '    ... on CategoryCard {\n' +
            '      id\n' +
            '      name\n' +
            '      url\n' +
            '      image {\n' +
            '        description\n' +
            '        id\n' +
            '        imageType\n' +
            '        __typename\n' +
            '      }\n' +
            '      __typename\n' +
            '    }\n' +
            '    __typename\n' +
            '  }\n' +
            '  __typename\n' +
            '}\n' +
            'fragment ArticleContentFields on ArticleCard {\n' +
            '  __typename\n' +
            '  id\n' +
            '  url\n' +
            '  name\n' +
            '  type\n' +
            '  image {\n' +
            '    ...ImageFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  video {\n' +
            '    ...VideoFields\n' +
            '    __typename\n' +
            '  }\n' +
            '  trackingCode\n' +
            '}\n',
        variables: {
            categoryId: '12345',
        },
    },
};