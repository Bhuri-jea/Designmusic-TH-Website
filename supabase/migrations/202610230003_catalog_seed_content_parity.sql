begin;

-- Restore the real storefront copy only while a seeded row still contains the
-- original migration placeholder. Seller edits are never overwritten.
with copy(slug,locale,name,badge,short_description,description) as (values
 ('saxophone-end-plug','en','Saxophone End Plug','Best Seller','Customizable end plugs with over 35 color options, marble patterns, and animal models.','An end plug protects the delicate octave-key mechanism and neck receiver while the saxophone is in its case. We believe a functional tool should also be memorable, so the collection includes more than 35 plain, clear, pastel and metallic colors, two-color and marble-like patterns, animal models, and customizable name plates.'),
 ('saxophone-end-plug','th','จุก Endplug แซกโซโฟน','สินค้าขายดี','จุกปิดปลายแซกโซโฟนแบบปรับแต่งได้ มีสี ลายหินอ่อน และรูปสัตว์ให้เลือกมากกว่า 35 แบบ','จุก Endplug เป็นอุปกรณ์จำเป็นที่ช่วยปกป้องกลไกคีย์อ็อกเทฟและตัวรับคอของแซกโซโฟนเมื่อเก็บในกระเป๋า ช่วยลดความเสี่ยงของการสึกหรอและความเสียหายระหว่างการจัดเก็บ เราสร้างสรรค์ทั้งฟังก์ชันและสไตล์ด้วยตัวเลือกกว่า 35 แบบ ทั้งสีเรียบ สีใส สีพาสเทล สีเมทัลลิก แบบสองสี ลายหินอ่อน รูปสัตว์ และป้ายชื่อที่ปรับแต่งได้'),
 ('saxophone-end-plug','ja','サックス用エンドプラグ','ベストセラー','35種類以上のカラー、マーブル模様、動物モチーフから選べるカスタマイズ可能なエンドプラグ。','エンドプラグは、繊細なオクターブキー機構へのダメージを防ぎ、ケース内でネックレシーバーを守るための必須アイテムです。機能性だけでなくデザイン性も重視し、35種類以上の無地・クリア・パステル・メタリックカラー、2色やマーブル模様、動物モチーフ、名入れプレートからお選びいただけます。'),
 ('saxophone-end-plug','zh-CN','萨克斯管端塞','畅销产品','可定制的萨克斯管端塞，提供超过 35 种颜色、云石纹和动物造型。','端塞是保护萨克斯八度键机构和颈部接收器的重要配件，能够防止乐器放入盒内时的磨损与碰撞。我们兼顾实用与美感，提供超过 35 种纯色、透明色、柔和色和金属色，以及双色、云石纹、动物主题造型和可定制姓名牌。'),
 ('shakuhachi','en','Shakuhachi S-1/D','Innovative approach','Resin-crafted Shakuhachi with interchangeable mouthpieces and adjustable pitch control.','Designed beyond the boundaries of traditional Japanese music, this is our vision of the Shakuhachi as an instrument for everyone. Its resin body resists dryness and climate changes while preserving the elegant appearance of natural bamboo, making it ideal for travel. The body and interchangeable mouthpieces are engineered separately for tonal balance and effortless playability. Replaceable cork joints remove looseness and allow fine pitch adjustment by insertion depth. Its ergonomic shape supports smooth finger movement, fast response, and a three-octave expressive range.'),
 ('shakuhachi','th','ชากุฮาจิ S-1/D','แนวคิดนวัตกรรม','ชากุฮาจิเรซินพร้อมส่วนปากที่เปลี่ยนได้และการปรับระดับเสียงอย่างละเอียด','ออกแบบให้ก้าวข้ามขอบเขตของดนตรีญี่ปุ่นแบบดั้งเดิม นี่คือวิสัยทัศน์ของเราที่ให้ชากุฮาจิเป็นเครื่องดนตรีสำหรับทุกคน ผลิตจากเรซินที่ทนต่อความแห้งและการเปลี่ยนแปลงของสภาพอากาศ พร้อมรักษารูปลักษณ์ที่สง่างามของไม้ไผ่ธรรมชาติ จึงเหมาะสำหรับการเดินทาง ตัวเครื่องและส่วนปากออกแบบแยกกันเพื่อสมดุลของโทนเสียงและความสะดวกในการเล่น ข้อต่อคอร์กที่เปลี่ยนได้ช่วยลดความหลวมและปรับระดับเสียงได้ด้วยความลึกในการสวม รูปทรงตามหลักสรีรศาสตร์ช่วยให้นิ้วเคลื่อนไหวราบรื่น ตอบสนองเร็ว และเล่นได้สามช่วงเสียง'),
 ('shakuhachi','ja','デザインミュージック S-1/D 尺八','革新的なアプローチ','交換式の歌口と音程調整機構を備えた樹脂製尺八。','伝統的な日本音楽と現代加工技術を結び、尺八をみんなの楽器として再解釈しました。乾燥や気候変動に強い樹脂素材を使いながら天然竹の優雅な外観を保ち、旅行にも適しています。胴体と歌口を分離設計して音色のバランスと滑らかな演奏性を実現。交換可能なコルク接続部で緩みを抑え、挿入深度による音程の微調整ができます。人間工学に基づく形状で指が滑らかに動き、素早く反応し、3オクターブの広い表現域を演奏できます。'),
 ('shakuhachi','zh-CN','Design Music S-1/D 尺八','创新设计','树脂尺八，配备可更换吹口和音高校准设计。','突破传统日本音乐的边界，我们将尺八重新诠释为人人可用的乐器。树脂材料耐干燥和气候变化，同时保留天然竹材的优雅外观，适合旅行携带。管身与吹奏部分独立设计，以获得平衡的音色和流畅的演奏感。可更换软木接头可消除松动，并通过插入深度微调音高。符合人体工学的形状让手指移动顺畅、响应迅速，并可轻松覆盖三个八度。'),
 ('siliconepads','en','Silicone Pads','New Release','Pointed-cone silicone pads that help reduce octave-key air noise.','For saxophone and clarinet octave keys. The innovative pointed-cone shape reduces the area of stagnant air, redirects airflow to the sides, and helps high notes speak more clearly and comfortably. The durable silicone construction is designed for a long service life. Available by direct reservation with the shop.'),
 ('siliconepads','th','นวมซิลิโคน','สินค้าใหม่','นวมซิลิโคนทรงกรวยหัวแหลม ช่วยลดเสียงรบกวนของลมบริเวณคีย์อ็อกเทฟ','สำหรับคีย์อ็อกเทฟของแซกโซโฟนและคลาริเน็ต รูปทรงกรวยหัวแหลมช่วยลดบริเวณอากาศค้าง เปลี่ยนทิศทางลมออกด้านข้าง และช่วยให้โน้ตสูงตอบสนองชัดเจนและเล่นสบายขึ้น วัสดุซิลิโคนมีอายุการใช้งานยาวนาน สินค้านี้รับจองโดยติดต่อร้านโดยตรง'),
 ('siliconepads','ja','シリコンタンポ','新製品','オクターブキーの気流ノイズを抑える先端円錐形シリコンタンポ。','サックスとクラリネットのオクターブキー用です。先端が尖った円錐形状により空気が滞留する範囲を減らし、気流を側面へ導いて、高音をより明瞭かつ快適に発音しやすくします。耐久性のあるシリコン素材で長寿命を目指しました。ご予約は店舗へ直接お問い合わせください。'),
 ('siliconepads','zh-CN','硅胶垫','新品','尖锥形硅胶垫，有助于减少八度键气流噪声。','适用于萨克斯和单簧管八度键。创新的尖锥形设计可减少空气滞留区域，将气流导向两侧，使高音更清晰、更容易演奏。耐用的硅胶结构具有较长使用寿命。本产品需直接联系店铺预约。')
)
update public.catalog_product_translations translation
set name=copy.name,badge=copy.badge,short_description=copy.short_description,description=copy.description
from copy join public.catalog_products product on product.slug=copy.slug
where translation.product_id=product.id and translation.locale=copy.locale
  and translation.description in(
   'The existing product content is preserved in the seller-managed catalog.',
   'รายละเอียดผลิตภัณฑ์ฉบับเดิมได้รับการย้ายเข้าสู่แค็ตตาล็อกที่ผู้ขายจัดการได้'
  );

with gallery(slug,position,url,alt) as (values
 ('saxophone-end-plug',1,'/images/endplug3.jpg','Saxophone end plug detail'),
 ('shakuhachi',1,'/images/ShakuhachiPoster2.jpg','Shakuhachi S-1/D product view'),
 ('shakuhachi',2,'/images/ShakuhachiPoster3.jpg','Shakuhachi S-1/D detail'),
 ('siliconepads',1,'/images/SiliconePad2.jpg','Silicone pad detail'),
 ('siliconepads',2,'/images/SiliconePad3.jpg','Silicone pad detail')
)
insert into public.catalog_product_images(product_id,url,alt,position,is_primary)
select product.id,gallery.url,gallery.alt,gallery.position,false
from gallery join public.catalog_products product on product.slug=gallery.slug
on conflict(product_id,position) do nothing;

commit;
