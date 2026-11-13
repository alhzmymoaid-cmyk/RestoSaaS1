-- ============================================================================
-- البيانات التجريبية الكاملة (Idempotent Seed v2.1)
-- آمن لإعادة التشغيل عدة مرات دون أي تكرار (ON CONFLICT DO UPDATE)
-- ============================================================================

DO $$
DECLARE
  v_bh_id UUID := '11111111-1111-1111-1111-111111111111';
  v_sk_id UUID := '22222222-2222-2222-2222-222222222222';
  v_os_id UUID := '33333333-3333-3333-3333-333333333333';

  v_cat_wagyu UUID := '22222222-1111-1111-1111-111111111111';
  v_cat_chicken UUID := '22222222-2222-1111-1111-111111111111';
  v_cat_boxes UUID := '22222222-3333-1111-1111-111111111111';
  v_cat_sides UUID := '22222222-4444-1111-1111-111111111111';
  v_cat_drinks UUID := '22222222-5555-1111-1111-111111111111';

  v_sk_cat1 UUID := '44444444-1111-1111-1111-111111111111';
  v_os_cat1 UUID := '55555555-1111-1111-1111-111111111111';
BEGIN

  -- 1. مطعم برجر هاوس (BURGER HOUSE)
  INSERT INTO public.restaurants (
    id, slug, name, tagline, description, owner_email,
    logo_url, hero_image_url, hero_badge, hero_title, hero_subtitle,
    hero_primary_cta, hero_secondary_cta,
    story_badge, story_title, story_content, story_image_url,
    primary_color, secondary_color, accent_color, bg_color, surface_color,
    heading_font, body_font, theme_mode,
    whatsapp_number, phone, address, city, visits_count, is_active
  ) VALUES (
    v_bh_id,
    'burger-house',
    'برجر هاوس | BURGER HOUSE',
    'واغيو سماش حرفي وبريسكت مدخن على حطب البلوط',
    'وجهتك الفاخرة لتجربة البرجر الحرفي المحضر من أجود لحوم الواغيو الأسترالي فئة A5 وخبز البريوش الطازج والصوصات المحضرة يومياً في مطبخنا.',
    'owner@burgerhouse.sa',
    '/images/burger-house/hero-wagyu-smash.jpg',
    '/images/burger-house/hero-wagyu-smash.jpg',
    'لحم واغيو أسترالي طازج 100% يُحضر عند الطلب',
    'حيث تلتقي فخامة الواغيو بنار الشواية الحية',
    'تذوق التوازن المثالي بين القرمشة الكراميلية من الخارج والطراوة الغنية بالعصارة من الداخل، مع خبز البريوش المخبوز بالزبدة الطبيعية.',
    'استكشف المنيو واطلب الآن',
    'عروض البوكسات الحصرية',
    'فلسفة برجر هاوس',
    'لا نصنع مجرد برجر.. بل نصمم تجربة تذوق متكاملة',
    'منذ انطلاقتنا في جدة، وضعنا معياراً صارماً لا يقبل المساومة: لحوم واغيو وأنجوس طازجة غير مجمدة تُفرم يومياً، بريسكت يُدخن ببطء لمدة 12 ساعة على حطب البلوط، وخبز بريوش يُخبز كل فجر ليصل إلى طاولتك في قمة نضارته.',
    '/images/burger-house/interior-lounge.jpg',
    '#D97706', '#F59E0B', '#FBBF24', '#0C0A09', '#1C1917',
    'Cairo', 'Tajawal', 'dark',
    '966535717670', '0535717670',
    'طريق الملك عبدالعزيز، حي الشاطئ، جدة المملكة العربية السعودية',
    'جدة', 18450, true
  ) ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        owner_email = COALESCE(NULLIF(public.restaurants.owner_email, ''), EXCLUDED.owner_email);

  -- 2. البانرات الإعلانية لبرجر هاوس (بمعرفات UUID ثابتة لمنع التكرار)
  INSERT INTO public.banners (id, restaurant_id, title, subtitle, badge_text, button_text, button_link, image_url, sort_order, starts_at, ends_at, is_active)
  VALUES
    ('b0000001-1111-1111-1111-111111111111', v_bh_id, 'بوكس الجمعات الملكي (The Royal Feast Box)', '4 برجر اختياري من الواغيو أو الكريسبي + بطاطس بريسكت بالجبن + 4 ستريبس دجاج + 4 صوصات حرفية ومشروبات', 'وفر 25% لفترة محدودة', 'اطلب البوكس الآن بـ 169 ر.س', '#menu', '/images/burger-house/banner-family-feast.jpg', 1, '2026-01-01T00:00:00Z', '2027-12-31T23:59:59Z', true),
    ('b0000002-1111-1111-1111-111111111111', v_bh_id, 'جديدنا: دبل بلاك ترفل واغيو (Black Truffle Wagyu)', 'شريحتان من لحم الواغيو الفاخر مع جبن الغرويير السويسري، فطر بري محمص بالزبدة، وأيولي الكمأة السوداء الإيطالية', 'إصدار الشيف الخاص', 'جربه الآن', '#menu', '/images/burger-house/truffle-wagyu-burger.jpg', 2, '2026-01-01T00:00:00Z', '2027-12-31T23:59:59Z', true),
    ('b0000003-1111-1111-1111-111111111111', v_bh_id, 'أجواء استثنائية في صالة برجر هاوس', 'استمتع بوجبتك أمام المطبخ المفتوح على اللهب الحي في فرع حي الشاطئ بجدة أو اطلب الآن للاستلام السريع', 'مفتوح حتى 4 فجراً نهاية الأسبوع', 'تعرف على موقعنا', '#contact', '/images/burger-house/interior-lounge.jpg', 3, '2026-01-01T00:00:00Z', '2027-12-31T23:59:59Z', true)
  ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        ends_at = EXCLUDED.ends_at;

  -- 3. العروض المؤقتة لبرجر هاوس (بمعرفات UUID ثابتة لمنع التكرار)
  INSERT INTO public.offers (id, restaurant_id, title, description, badge_text, original_price, offer_price, coupon_code, image_url, starts_at, ends_at, sort_order, is_active)
  VALUES
    ('f0000001-1111-1111-1111-111111111111', v_bh_id, 'وليمة برجر هاوس العائلية', '2 دبل واغيو سماش + 2 ميبل سيراتشا كريسبي + بطاطس بريسكت حجم عائلي + 4 مشروبات حرفية', 'الأكثر مبيعاً هذا الأسبوع', 225.00, 169.00, 'ROYAL169', '/images/burger-house/banner-family-feast.jpg', '2026-01-01T00:00:00Z', '2027-12-31T23:59:59Z', 1, true),
    ('f0000002-1111-1111-1111-111111111111', v_bh_id, 'ثنائي الترفل والسموك هاوس', 'برجر بلاك ترفل واغيو + برجر سموك هاوس بريسكت + بطاطس ترفل بارميزان + 2 ميلك شيك بلجيكي', 'عرض الثنائي الفاخر', 158.00, 124.00, 'DUO124', '/images/burger-house/truffle-wagyu-burger.jpg', '2026-01-01T00:00:00Z', '2027-12-31T23:59:59Z', 2, true)
  ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title,
        offer_price = EXCLUDED.offer_price,
        ends_at = EXCLUDED.ends_at;

  -- 4. الأقسام الرئيسية لبرجر هاوس
  INSERT INTO public.categories (id, restaurant_id, name, slug, description, image_url, sort_order, is_visible)
  VALUES
    (v_cat_wagyu, v_bh_id, 'برجر الواغيو والأنجوس', 'wagyu-burgers', 'برجر لحم واغيو وأنجوس طازج مشوي على طريقة السماش أو اللهب المباشر', '/images/burger-house/hero-wagyu-smash.jpg', 1, true),
    (v_cat_chicken, v_bh_id, 'برجر الدجاج المقرمش', 'crispy-chicken', 'صدور دجاج طازجة متبلة باللبن الرائب والأعشاب ومقلية لقرمشة ذهبية', '/images/burger-house/maple-sriracha-chicken.jpg', 2, true),
    (v_cat_boxes, v_bh_id, 'بوكسات الجمعات والعروض', 'sharing-boxes', 'بوكسات متكاملة مصممة للعائلة والأصدقاء بتشكيلة غنية', '/images/burger-house/banner-family-feast.jpg', 3, true),
    (v_cat_sides, v_bh_id, 'البطاطس المحملة والمقبلات', 'loaded-fries-sides', 'بطاطس حرفية مع البريسكت المدخن والجبن المعتق والستريبس', '/images/burger-house/loaded-brisket-fries.jpg', 4, true),
    (v_cat_drinks, v_bh_id, 'الميلك شيك والموهيتو', 'artisan-drinks', 'ميلك شيك بالشوكولاتة البلجيكية والكراميل المملح وموهيتو الفواكه الطبيعية', '/images/burger-house/artisan-shakes-mojito.jpg', 5, true)
  ON CONFLICT (restaurant_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description;

  -- 5. المنتجات لبرجر هاوس (بمعرفات UUID ثابتة لمنع التكرار)
  INSERT INTO public.products (
    id, restaurant_id, category_id, name, description, price, compare_at_price,
    calories, prep_time_minutes, image_url,
    is_available, is_visible, is_bestseller, is_featured, is_new,
    sizes, addons, views_count, orders_count, sort_order
  ) VALUES
    (
      'd0000001-1111-1111-1111-111111111111', v_bh_id, v_cat_wagyu,
      'دبل واغيو هاوس سماش (Double Wagyu House Smash)',
      'شريحتان من لحم الواغيو الأسترالي الفاخر بحواف مقرمشة، شريحتا جبن شيدر إنجليزي معتق، بصل مكرمل ببطء لمدة 4 ساعات، شرائح بيكون بقري مدخن، وصوص برجر هاوس المدخن في خبز بريوش محمص بالزبدة.',
      46.00, 54.00, 780, 12,
      '/images/burger-house/hero-wagyu-smash.jpg',
      true, true, true, true, false,
      '[{"id":"s1","name":"سنجل (120 جرام)","price_delta":-9},{"id":"s2","name":"دبل كلاسيك (220 جرام)","price_delta":0},{"id":"s3","name":"تربل مونستر (330 جرام)","price_delta":14}]'::jsonb,
      '[{"id":"a1","name":"شريحة جبن شيدر معتق إضافية","price":5},{"id":"a2","name":"بيكون بقري مدخن مقرمش","price":8},{"id":"a3","name":"تحويل إلى وجبة (بطاطس + مشروب)","price":14},{"id":"a4","name":"صوص ترفل أسود جانبي","price":6}]'::jsonb,
      3420, 1290, 1
    ),
    (
      'd0000002-1111-1111-1111-111111111111', v_bh_id, v_cat_wagyu,
      'بلاك ترفل واغيو رويال (Black Truffle Wagyu Royale)',
      'لحم واغيو مشوي مع جبن غرويير سويسري ذائب، فطر بورتوبيلو وشيتاكي محمص بالزبدة والثوم، وأيولي الكمأة السوداء الإيطالية الفاخرة على خبز بريوش ذهبي.',
      54.00, NULL, 820, 14,
      '/images/burger-house/truffle-wagyu-burger.jpg',
      true, true, true, true, true,
      '[{"id":"s1","name":"سنجل واغيو","price_delta":-10},{"id":"s2","name":"دبل واغيو (الموصى به)","price_delta":0}]'::jsonb,
      '[{"id":"a1","name":"فطر بري إضافي بالزبدة","price":7},{"id":"a2","name":"جبن غرويير سويسري إضافي","price":6},{"id":"a3","name":"تحويل إلى وجبة ترفل (بطاطس ترفل + مشروب)","price":18}]'::jsonb,
      2890, 980, 2
    ),
    (
      'd0000003-1111-1111-1111-111111111111', v_bh_id, v_cat_wagyu,
      'سموك هاوس بريسكت دبل (Smokehouse Brisket Double)',
      'مزيج أسطوري يجمع شريحتي برجر أنجوس مع 80 جرام من لحم البريسكت المدخن ببطء لمدة 12 ساعة على حطب البلوط، حلقات بصل مقرمشة، جبن شيدر، وصوص باربكيو القيقب المدخن.',
      52.00, 59.00, 890, 14,
      '/images/burger-house/smokehouse-brisket-burger.jpg',
      true, true, true, true, false,
      '[{"id":"s1","name":"حجم عادي","price_delta":0},{"id":"s2","name":"إكسترا بريسكت مدخن (+60 جرام)","price_delta":14}]'::jsonb,
      '[{"id":"a1","name":"حلقات بصل مقرمشة إضافية","price":5},{"id":"a2","name":"شرائح هالبينو مخلل","price":3},{"id":"a3","name":"تحويل إلى وجبة كاملة","price":14}]'::jsonb,
      2410, 860, 3
    ),
    (
      'd0000004-1111-1111-1111-111111111111', v_bh_id, v_cat_chicken,
      'ميبل سيراتشا كريسبي تشيكن (Maple Sriracha Crispy)',
      'صدر دجاج طازج مقرمش مغموس في جليز شراب القيقب الكندي الحار والسيراتشا، مع سلطة الكولسلو الأرجوانية المقرمشة ومخلل الشبت المنزلي وصوص الرانش بالأعشاب.',
      38.00, 44.00, 690, 11,
      '/images/burger-house/maple-sriracha-chicken.jpg',
      true, true, true, true, false,
      '[{"id":"s1","name":"حرارة معتدلة (Classic Maple)","price_delta":0},{"id":"s2","name":"حرارة نارية (Nashville Hot)","price_delta":2},{"id":"s3","name":"دبل صدر دجاج مقرمش","price_delta":13}]'::jsonb,
      '[{"id":"a1","name":"جبن شيدر ذائب","price":4},{"id":"a2","name":"صوص ميبل سيراتشا إضافي","price":4},{"id":"a3","name":"تحويل إلى وجبة كاملة","price":14}]'::jsonb,
      3100, 1150, 4
    ),
    (
      'd0000005-1111-1111-1111-111111111111', v_bh_id, v_cat_boxes,
      'بوكس الجمعات الملكي (The Royal Gathering Box)',
      'يحتوي على 4 برجر من اختيارك (واغيو سماش / ترفل / ميبل كريسبي)، مقلاة بطاطس البريسكت والجبن العائلية، 6 قطع تندرز دجاج مقرمشة، و4 صوصات حرفية.',
      169.00, 225.00, 3200, 20,
      '/images/burger-house/banner-family-feast.jpg',
      true, true, true, true, true,
      '[{"id":"s1","name":"بوكس 4 أشخاص","price_delta":0},{"id":"s2","name":"بوكس 6 أشخاص الملكي","price_delta":65}]'::jsonb,
      '[{"id":"a1","name":"4 مشروبات موهيتو أو غازية","price":28},{"id":"a2","name":"مجموعة صوصات الشيف (6 عبوات)","price":18}]'::jsonb,
      1980, 640, 5
    ),
    (
      'd0000006-1111-1111-1111-111111111111', v_bh_id, v_cat_sides,
      'بطاطس البريسكت المدخن والشيدر (Smoked Brisket Loaded Fries)',
      'بطاطس بقشرها مقرمشة ذهبية مغطاة بصلصة جبن الشيدر المعتق الدافئة، قطع لحم البريسكت المدخن الطري، هالبينو مخلل، بصل أخضر، وصوص تشيبوتلي أيولي.',
      32.00, NULL, 640, 9,
      '/images/burger-house/loaded-brisket-fries.jpg',
      true, true, true, false, false,
      '[{"id":"s1","name":"حجم فردي","price_delta":0},{"id":"s2","name":"حجم مشاركة (Sharing Skillet)","price_delta":12}]'::jsonb,
      '[{"id":"a1","name":"إضافة بيكون بقري مقرمش","price":7},{"id":"a2","name":"إضافة صوص ترفل","price":6}]'::jsonb,
      2150, 920, 6
    ),
    (
      'd0000007-1111-1111-1111-111111111111', v_bh_id, v_cat_drinks,
      'ميلك شيك الشوكولاتة البلجيكية والكراميل المملح',
      'آيس كريم فانيلا مدغشقر الحرفي مخفوق مع الشوكولاتة البلجيكية الداكنة وصوص الكراميل المملح وكريمة الخفق الطازجة.',
      26.00, NULL, 510, 5,
      '/images/burger-house/artisan-shakes-mojito.jpg',
      true, true, false, true, false,
      '[{"id":"s1","name":"شوكولاتة بلجيكية وكراميل مملح","price_delta":0},{"id":"s2","name":"موهيتو باشن فروت ونعناع طازج","price_delta":-4}]'::jsonb,
      '[{"id":"a1","name":"إضافة إسبريسو شوت","price":5}]'::jsonb,
      1540, 610, 7
    )
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        price = EXCLUDED.price,
        sizes = EXCLUDED.sizes,
        addons = EXCLUDED.addons;

  -- 6. معرض الصور لبرجر هاوس (بمعرفات UUID ثابتة لمنع التكرار)
  INSERT INTO public.gallery_images (id, restaurant_id, title, caption, image_url, sort_order, is_visible)
  VALUES
    ('a0000001-1111-1111-1111-111111111111', v_bh_id, 'صالة الطعام والمطبخ المفتوح', 'تصميم داخلي دافئ يجمع بين الخشب الطبيعي والنحاس والإضاءة الخافتة أمام شواية اللهب المباشر', '/images/burger-house/interior-lounge.jpg', 1, true),
    ('a0000002-1111-1111-1111-111111111111', v_bh_id, 'دبل واغيو هاوس سماش', 'تحمير كراميلي متقن مع الجبن الذائب والبصل المكرمل', '/images/burger-house/hero-wagyu-smash.jpg', 2, true),
    ('a0000003-1111-1111-1111-111111111111', v_bh_id, 'ولائم الجمعات الفاخرة', 'تشكيلة متكاملة من البرجر الحرفي والبطاطس المحملة بالبريسكت', '/images/burger-house/banner-family-feast.jpg', 3, true),
    ('a0000004-1111-1111-1111-111111111111', v_bh_id, 'بلاك ترفل واغيو', 'فطر بري محمص بالزبدة مع أيولي الكمأة السوداء الإيطالية', '/images/burger-house/truffle-wagyu-burger.jpg', 4, true),
    ('a0000005-1111-1111-1111-111111111111', v_bh_id, 'بطاطس البريسكت المدخن', 'قطع بريسكت مدخنة 12 ساعة مع الشيدر المعتق والهالبينو', '/images/burger-house/loaded-brisket-fries.jpg', 5, true),
    ('a0000006-1111-1111-1111-111111111111', v_bh_id, 'المشروبات الحرفية والميلك شيك', 'ميلك شيك بلجيكي وموهيتو باشن فروت منعش', '/images/burger-house/artisan-shakes-mojito.jpg', 6, true)
  ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title,
        caption = EXCLUDED.caption;

  -- 7. المطعم الثاني: كنافة سكره (KONAFA SUKRAH)
  INSERT INTO public.restaurants (
    id, slug, name, tagline, description, owner_email,
    logo_url, hero_image_url, hero_badge, hero_title, hero_subtitle,
    hero_primary_cta, hero_secondary_cta,
    story_badge, story_title, story_content, story_image_url,
    primary_color, secondary_color, accent_color, bg_color, surface_color,
    heading_font, body_font, theme_mode,
    whatsapp_number, phone, address, city, delivery_fee, visits_count, is_active
  ) VALUES (
    v_sk_id,
    'konafa-sukrah',
    'كنافة سكره | KONAFA SUKRAH',
    'حلويات شرقية فاخرة وكنافة نابلسية على الفحم والفرن',
    'وجهة الحلويات الشرقية الفاخرة في جدة — كنافة بالقشطة الطازجة والجبن العكاوي والفستق الحلبي والشوكولاتة البلجيكية.',
    'owner@sukrah.sa',
    '/images/burger-house/artisan-shakes-mojito.jpg',
    '/images/burger-house/artisan-shakes-mojito.jpg',
    'سمن بري طبيعي وجبن عكاوي فاخر يومياً',
    'كنافة سكره.. أصالة الحلوى الشرقية بلمسة ملكية',
    'تُحضر الكنافة لدينا طازجة عند كل طلب باستخدام السمن البري الطبيعي والفستق الحلبي الفاخر.',
    'تصفح منيو كنافة سكره',
    'عروض الصواني والجمعات',
    'حكاية كنافة سكره',
    'شغف الكنافة الذهبية والقهوة السعودية الأصيلة',
    'نختار أجود خيوط الكنافة والجبن العكاوي والقشطة البلدية لنقدمها ساخنة ومقرمشة في كل طلب.',
    '/images/burger-house/interior-lounge.jpg',
    '#10B981', '#34D399', '#6EE7B7', '#061512', '#0D2621',
    'Amiri', 'Tajawal', 'dark',
    '966535717670', '0535717670',
    'حي البغدادية الغربية، شارع حمزة شحاتة، جدة',
    'جدة', 0.00, 12390, true
  ) ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        owner_email = COALESCE(NULLIF(public.restaurants.owner_email, ''), EXCLUDED.owner_email);

  INSERT INTO public.categories (id, restaurant_id, name, slug, description, image_url, sort_order, is_visible)
  VALUES (
    v_sk_cat1, v_sk_id, 'الكنافة الملكية والخاصة', 'royal-kunafa',
    'كنافة بالقشطة والجبن والنوتيلا واللوتس والفستق الحلبي',
    '/images/burger-house/artisan-shakes-mojito.jpg', 1, true
  ) ON CONFLICT (restaurant_id, slug) DO UPDATE
    SET name = EXCLUDED.name;

  INSERT INTO public.products (
    id, restaurant_id, category_id, name, description, price, compare_at_price,
    calories, prep_time_minutes, image_url, is_available, is_visible, is_bestseller, is_featured, is_new,
    sizes, addons, views_count, orders_count, sort_order
  ) VALUES (
    'd0000001-2222-2222-2222-222222222222', v_sk_id, v_sk_cat1,
    'كنافة عش البلبل بالفستق الحلبي واللوتس',
    'خيوط كنافة ذهبية مقرمشة محشوة بالفستق الحلبي الفاخر وصوص اللوتس والشوكولاتة البلجيكية.',
    54.00, 65.00, 580, 12,
    '/images/burger-house/artisan-shakes-mojito.jpg',
    true, true, true, true, false,
    '[{"id":"s1","name":"حجم وسط","price_delta":0},{"id":"s2","name":"حجم عائلي كبير","price_delta":22}]'::jsonb,
    '[{"id":"a1","name":"إضافة صوص فستق حلبي","price":5},{"id":"a2","name":"إضافة آيس كريم فانيلا","price":6}]'::jsonb,
    1840, 720, 1
  ) ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        price = EXCLUDED.price;

  -- 8. المطعم الثالث: أوساكا واغيو (OSAKA WAGYU)
  INSERT INTO public.restaurants (
    id, slug, name, tagline, description, owner_email,
    logo_url, hero_image_url, hero_badge, hero_title, hero_subtitle,
    hero_primary_cta, hero_secondary_cta,
    story_badge, story_title, story_content, story_image_url,
    primary_color, secondary_color, accent_color, bg_color, surface_color,
    heading_font, body_font, theme_mode,
    whatsapp_number, phone, address, city, delivery_fee, visits_count, is_active
  ) VALUES (
    v_os_id,
    'osaka-wagyu',
    'أوساكا واغيو جريل | OSAKA WAGYU',
    'ستيك هاوس ياباني وبرجر كوبي واغيو فاخر',
    'تجربة الشواء الياباني المعاصر على فحم البينشوتان الأبيض في الرياض.',
    'owner@osakawagyu.sa',
    '/images/burger-house/truffle-wagyu-burger.jpg',
    '/images/burger-house/truffle-wagyu-burger.jpg',
    'لحم كوبي ياباني مستورد A5',
    'تجربة الشواء الياباني المعاصر على نار البينشوتان',
    'قطع الواغيو الياباني المشوية بدقة مع صوصات الأومامي المعتقة.',
    'استعرض قائمة أوساكا',
    'عروض الشيف الياباني',
    'إرث أوساكا',
    'دقة المطبخ الياباني في كل تفصيلة',
    'نقدم قطع الواغيو الياباني المشوية على فحم البينشوتان الأبيض النقي.',
    '/images/burger-house/interior-lounge.jpg',
    '#E11D48', '#FB7185', '#FDA4AF', '#0F070A', '#1F1016',
    'Readex Pro', 'Readex Pro', 'dark',
    '966535717670', '0535717670',
    'طريق الأمير تركي الأول، حي حطين، الرياض',
    'الرياض', 20.00, 9840, true
  ) ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        owner_email = COALESCE(NULLIF(public.restaurants.owner_email, ''), EXCLUDED.owner_email);

  INSERT INTO public.categories (id, restaurant_id, name, slug, description, image_url, sort_order, is_visible)
  VALUES (
    v_os_cat1, v_os_id, 'برجر وساندو كوبي واغيو', 'kobe-sando',
    'برجر وساندو واغيو ياباني فاخر',
    '/images/burger-house/truffle-wagyu-burger.jpg', 1, true
  ) ON CONFLICT (restaurant_id, slug) DO UPDATE
    SET name = EXCLUDED.name;

  INSERT INTO public.products (
    id, restaurant_id, category_id, name, description, price, compare_at_price,
    calories, prep_time_minutes, image_url, is_available, is_visible, is_bestseller, is_featured, is_new,
    sizes, addons, views_count, orders_count, sort_order
  ) VALUES (
    'd0000001-3333-3333-3333-333333333333', v_os_id, v_os_cat1,
    'واغيو كاتسو ساندو بالكمأة (Wagyu Truffle Sando)',
    'توست شوكوبان ياباني محمص بالزبدة مع شريحة واغيو مقرمشة وصوص التونكاتسو المدخن.',
    78.00, NULL, 740, 15,
    '/images/burger-house/truffle-wagyu-burger.jpg',
    true, true, true, true, true,
    '[{"id":"s1","name":"حجم قياسي (180 جرام)","price_delta":0},{"id":"s2","name":"دبل كوبي واغيو","price_delta":35}]'::jsonb,
    '[{"id":"a1","name":"إضافة كافيار ترفل أسود","price":14}]'::jsonb,
    1420, 530, 1
  ) ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        price = EXCLUDED.price;

END $$;
