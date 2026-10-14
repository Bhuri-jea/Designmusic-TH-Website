export const languages = {
  en: 'English',
  ja: '日本語',
  'zh-CN': '中文',
  th: 'ภาษาไทย',
};

export const defaultLang = 'en';

export const ui = {
  en: {
    "cart.limit": "This selection exceeds the cart limit. Remove an item and try again.",
    "flow.account": "Account",
    "flow.login": "Sign in",
    "flow.loginHelp": "Sign in to manage your profile, bookings and orders.",
    "flow.unavailable": "This service is unavailable. Please try again later.",
    "flow.retry": "Try again",
    "flow.signInRequired": "Please sign in to continue.",
    "flow.loading": "Loading…",
    "flow.saving": "Saving…",
    "flow.saved": "Saved",
    "flow.save": "Save changes",
    "flow.failed": "Could not complete this request. Your details are retained; please try again.",
    "flow.stock": "These items are unavailable or already reserved. Check your cart and try again.",
    "flow.storage": "Allow browser storage to keep your cart and checkout retry safely.",
    "flow.attemptLimit": "Too many checkouts remain unresolved. Please contact us before starting another payment.",
    "flow.close": "Close",
    "flow.remove": "Remove item",
    "flow.menu": "Open menu",
    "flow.language": "Choose language",
    "flow.cart": "Open cart",
    "flow.name": "Full name",
    "flow.phone": "Phone number",
    "flow.email": "Email address",
    "flow.emailHelp": "This email is used for sign-in and cannot be changed here.",
    "flow.signOut": "Sign out",
    "flow.orders": "Orders",
    "flow.bookings": "Bookings",
    "flow.empty": "No records yet.",
    "flow.book": "Book an appointment",
    "flow.payment": "Payment status",
    "flow.pending": "Payment confirmation is pending. Please check again shortly.",
    "flow.paid": "Payment confirmed",
    "flow.expired": "Checkout expired. Inventory release is verified by the payment provider.",
    "flow.review": "This order needs seller review. Please contact us before paying again.",
    "flow.unknown": "No owned order could be found. No payment is confirmed here.",
    "flow.cancelled": "Checkout was closed. Your saved cart remains available; payment and reservations are unchanged by this page.",
    "flow.shop": "Continue shopping",
    "flow.address": "Please contact the seller if your delivery address needs attention. Payment confirmation alone does not confirm dispatch.",
    "flow.shippingAddress": "Shipping address",
    "flow.shippingAddressHelp": "Save your delivery address for your account. You can leave every field blank to remove it.",
    "flow.addressLine1": "Street address",
    "flow.addressLine2": "Apartment, suite, etc. (optional)",
    "flow.addressCity": "City",
    "flow.addressState": "State / province (optional)",
    "flow.addressPostalCode": "Postal code",
    "flow.addressCountry": "Country code (ISO 3166-1 alpha-2)",
    "flow.manageBookings": "Manage repair appointments",
    "flow.manageBookingsHelp": "Reschedule or cancel your upcoming repair appointments.",
    "booking.service": "Service",
    "booking.time": "Time",
    "booking.details": "Details",
    "booking.next": "Next",
    "booking.back": "Back",
    "booking.confirm": "Confirm booking",
    "booking.select": "Choose an instrument, service and available time.",
    "booking.notes": "Condition notes (optional)",
    "booking.photoHelp": "Describe the condition in notes. Photos are not uploaded through this form.",
    "booking.estimateHelp": "Indicative repair estimate in THB; final quote after inspection. This is not a checkout charge.",
    "booking.assessment": "Quote after inspection",
    "booking.none": "No available appointments. Please check again later.",
    "booking.collision": "That slot was just booked. Choose another available time.",
    "booking.confirmed": "Booking saved. Email and calendar updates may still be queued.",
    "booking.availabilityTitle": "Available repair appointments",
    "booking.calendarLinked": "Availability synced with our repair calendar.",
    "booking.calendarFallback": "Calendar sync is not configured yet; times only exclude website bookings.",
    "booking.availabilityHelp": "Times shown in Asia/Bangkok (UTC+7).",
    "booking.manageTitle": "Manage repair appointments",
    "booking.reschedule": "Change appointment time",
    "booking.cancel": "Cancel appointment",
    "booking.cancelConfirm": "Cancel this repair appointment?",
    "booking.saveTime": "Save new time",
    "booking.timeUpdated": "Appointment time updated. The calendar mirror may take a few minutes to update.",
    "booking.cancelledStatus": "Appointment cancelled. The calendar mirror may take a few minutes to update.",
    "booking.modifyUnavailable": "This appointment can no longer be changed online.",
    "booking.calendarSourceError": "Calendar availability could not be loaded. Please try again later.",
    "booking.calendarSetupNeeded": "Calendar is not connected yet.",
    "booking.noManageable": "You have no upcoming appointments that can be changed.",
    "booking.soprano": "Soprano saxophone",
    "booking.alto": "Alto saxophone",
    "booking.tenor": "Tenor saxophone",
    "booking.baritone": "Baritone saxophone",
    "booking.bassoon": "Bassoon",
    "booking.other": "Other",
    "booking.basic": "Basic adjustment",
    "booking.standard": "Standard service",
    "booking.overhaul": "Full overhaul",
    "booking.assessmentLabel": "Assessment",
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.products': 'Products',
    'nav.services': 'Repair Services',

    'cart.title': 'Your Cart',
    'cart.quantity': 'Qty',
    'cart.empty': 'Your cart is empty',
    'cart.total': 'Total',
    'cart.checkout': 'Checkout',
    'cart.processing': 'Processing...',
    // product / purchase labels
    'product.selectToneHole': 'Select Tone Hole Size',
    'product.selectMouthpiece': 'Select Mouthpiece Type',
    'product.totalPrice': 'Total Price',
    'product.tone.standard': 'Standard',
    'product.tone.large': 'Large',
    'product.tone.standard.desc': 'Compact, clear tone. Easy pitch control.',
    'product.tone.large.desc': 'Rich, expressive tone. Not recommended for small fingers.',
    'product.mouth.balance': 'Balance',
    'product.mouth.traditional': 'Traditional',
    'product.mouth.modern': 'Modern',
    'product.mouth.balance.desc': 'Standard, clear tone. Beginner friendly.',
    'product.mouth.traditional.desc': 'Dark, warm and complex tone.',
    'product.mouth.modern.desc': 'Bright tone, enhanced harmonics.',
    'product.selectCustomization': 'Select Customization Option',
    'product.endplug.plain': '1 Plain Color',
    'product.endplug.twocolor': '2 Colors / Marble',
    'product.endplug.custom': 'Custom / Animal Model',
    'product.endplug.note': 'Same price for Soprano, Alto, Tenor, Baritone',
    'addtocart.add': 'Add to Cart - {price} {currency}',
    'addtocart.added': 'Added!',
    'booking.estimated': 'Estimated Price',

    'hero.mission': 'Innovative instruments. Exceptional craftsmanship.',
    'hero.title.crafting': 'Crafting',
    'hero.title.joy': '"Joy"',
    'hero.title.through': 'Through',
    'hero.title.perfection': '"Perfection"',
    'hero.desc':
      'No matter how much time and dedication it takes, we pursue only the finest craftsmanship. High-quality instruments, accessories, and repair services for students and musicians around the world.',
    'hero.cta1': 'Discover Our Products',
    'hero.cta2': 'Explore Services',
    'hero.scroll': 'Scroll',

    'home.philosophy.title':
      'The resonance of <span class="font-bold italic text-white">"joy in music"</span>',

    'home.philosophy.p1':
      '<span class="font italic text-white">"Sanuk"</span> — the Thai belief that joy is an essential part of life — is a value we deeply cherish and hope to share with the world. We believe music and musical instruments have the power to inspire people, connect communities, and bring warmth to society.',

    'home.philosophy.p2':
      'To honor this philosophy, <span class="font italic text-white">we embrace the Japanese spirit of "Kodawari"</span> — an uncompromising dedication to craftsmanship and detail. By refining every subtle element, we strive to create instruments and services that bring genuine joy to both players and listeners.',

    'home.philosophy.link': 'Read Our Story',

    'home.masterpieces.subtitle': 'Products',
    'home.masterpieces.title': 'Exquisite Craftsmanship',

    'home.shakuhachi.title': 'Modern Shakuhachi',
    'home.shakuhachi.desc':
      'Innovative modern design meets traditional sound. An instrument designed for everyone.',

    'home.viewdetail': 'View Details',

    'home.pads.title': 'Precision silicone Pads',
    'home.pads.desc':
      'Clarity in every note with effortless playability.',

    'home.repair.title': 'Expert Repair',
    'home.repair.desc':
      'Restoring the voice of your beloved instruments.',

    'home.viewall': 'View All Products',

    'home.cta.title': 'Ready to shape your sound?',
    'home.cta.button': 'Begin Your Journey',

    'about.subtitle': 'About Us',

    'about.title':
      '<span class="text-4xl md:text-5xl block">Instrument innovators <br> and woodwind repair specialists</span>',

    'about.desc1':
      'Based in the Sathorn district of Bangkok.',

    'about.desc2':
      'With intensive repair training in Taiwan and more than a decade of hands-on experience, we dedicate ourselves to refining the sound, response, and individuality of every instrument. Our products are crafted for musicians of all levels — from beginners discovering their first notes to professionals seeking deeper nuance and expression. Every repair and service is carefully tailored to the individual player, with deep respect for both the musician and the instrument.',

    'about.tailor.title':
      'Creating a legacy of lasting value',

    'about.tailor.p1':
      'Our mission is to make music more accessible to everyone. We believe craftsmanship and knowledge can break down barriers and open new possibilities for anyone who wishes to play.',

    'about.tailor.p2':
      'We strive to create meaningful experiences that resonate far beyond the music itself.',

    'about.quote':
      '“Leave something meaningful behind.<br/><span class="italic text-neutral-400">That is true legacy.</span>”',

    'about.btn.products': 'Explore Products',
    'about.btn.repair': 'Explore Repair Services',
  },

  ja: {
    "cart.limit": "カートの上限を超えています。商品を減らしてください。",
    "flow.account": "アカウント",
    "flow.login": "ログイン",
    "flow.loginHelp": "プロフィール・予約・注文を管理できます。",
    "flow.unavailable": "現在ご利用いただけません。後ほどお試しください。",
    "flow.retry": "再試行",
    "flow.signInRequired": "続行するにはログインしてください。",
    "flow.loading": "読み込み中…",
    "flow.saving": "保存中…",
    "flow.saved": "保存しました",
    "flow.save": "変更を保存",
    "flow.failed": "処理できませんでした。入力内容を保持しています。再試行してください。",
    "flow.stock": "在庫がないか予約済みです。カートを確認してください。",
    "flow.storage": "カートと決済再試行を保存するため、ブラウザの保存を許可してください。",
    "flow.attemptLimit": "未解決の決済が多すぎます。新しいお支払いを始める前にお問い合わせください。",
    "flow.close": "閉じる",
    "flow.remove": "商品を削除",
    "flow.menu": "メニューを開く",
    "flow.language": "言語を選択",
    "flow.cart": "カートを開く",
    "flow.name": "氏名",
    "flow.phone": "電話番号",
    "flow.email": "メールアドレス",
    "flow.emailHelp": "このメールアドレスはログインに使われ、ここでは変更できません。",
    "flow.signOut": "ログアウト",
    "flow.orders": "注文",
    "flow.bookings": "予約",
    "flow.empty": "まだ記録はありません。",
    "flow.book": "修理を予約",
    "flow.payment": "お支払い状況",
    "flow.pending": "お支払いの確認待ちです。しばらくしてからご確認ください。",
    "flow.paid": "お支払いを確認しました",
    "flow.expired": "決済の有効期限が切れました。在庫解放は決済サービスの確認に基づきます。",
    "flow.review": "販売者の確認が必要です。再決済の前にお問い合わせください。",
    "flow.unknown": "ご本人の注文を確認できません。支払い完了は表示できません。",
    "flow.cancelled": "決済画面を閉じました。保存済みカートは保持されます。このページでは決済や在庫予約を変更しません。",
    "flow.shop": "買い物を続ける",
    "flow.address": "配送先の確認が必要な場合は販売者にご連絡ください。支払い完了は発送完了を意味しません。",
    "flow.shippingAddress": "配送先住所",
    "flow.shippingAddressHelp": "配送先住所をアカウントに保存できます。すべて空欄にすると削除されます。",
    "flow.addressLine1": "住所",
    "flow.addressLine2": "建物名・部屋番号（任意）",
    "flow.addressCity": "市区町村",
    "flow.addressState": "都道府県（任意）",
    "flow.addressPostalCode": "郵便番号",
    "flow.addressCountry": "国コード（ISO 3166-1 alpha-2）",
    "flow.manageBookings": "修理予約を管理",
    "flow.manageBookingsHelp": "今後の修理予約の日時変更やキャンセルができます。",
    "booking.service": "サービス",
    "booking.time": "日時",
    "booking.details": "詳細",
    "booking.next": "次へ",
    "booking.back": "戻る",
    "booking.confirm": "予約を確定",
    "booking.select": "楽器・サービス・空き時間を選択してください。",
    "booking.notes": "状態について（任意）",
    "booking.photoHelp": "状態をメモに記入してください。このフォームから写真は送信されません。",
    "booking.estimateHelp": "THBでの修理概算です。正式な見積もりは点検後にご案内します。決済金額ではありません。",
    "booking.assessment": "点検後にお見積もり",
    "booking.none": "予約可能な時間がありません。後ほどご確認ください。",
    "booking.collision": "この時間は予約済みです。別の空き時間を選んでください。",
    "booking.confirmed": "予約を保存しました。メールやカレンダーへの反映は処理中の場合があります。",
    "booking.availabilityTitle": "修理の空き予約枠",
    "booking.calendarLinked": "修理カレンダーの予定を反映しています。",
    "booking.calendarFallback": "カレンダー未接続のため、サイト上の予約のみ反映しています。",
    "booking.availabilityHelp": "表示時刻はタイ（Asia/Bangkok、UTC+7）です。",
    "booking.manageTitle": "修理予約の管理",
    "booking.reschedule": "予約日時を変更",
    "booking.cancel": "予約をキャンセル",
    "booking.cancelConfirm": "この修理予約をキャンセルしますか？",
    "booking.saveTime": "新しい日時を保存",
    "booking.timeUpdated": "予約日時を変更しました。カレンダーへの反映には数分かかる場合があります。",
    "booking.cancelledStatus": "予約をキャンセルしました。カレンダーへの反映には数分かかる場合があります。",
    "booking.modifyUnavailable": "この予約はオンラインで変更できません。",
    "booking.calendarSourceError": "カレンダーの空き状況を読み込めません。しばらくしてから再度お試しください。",
    "booking.calendarSetupNeeded": "カレンダーはまだ接続されていません。",
    "booking.noManageable": "オンラインで変更できる今後の予約はありません。",
    "booking.soprano": "ソプラノサックス",
    "booking.alto": "アルトサックス",
    "booking.tenor": "テナーサックス",
    "booking.baritone": "バリトンサックス",
    "booking.bassoon": "ファゴット",
    "booking.other": "その他",
    "booking.basic": "基本調整",
    "booking.standard": "標準サービス",
    "booking.overhaul": "オーバーホール",
    "booking.assessmentLabel": "点検・お見積もり",
    'product.tone.standard.desc': 'コンパクトで明瞭な音。ピッチのコントロールが容易です。',
    'product.tone.large.desc': '豊かで表現力のある音。小さな指の方には推奨されません。',
    'product.mouth.balance.desc': '標準的で明瞭な音。初心者向け。',
    'product.mouth.traditional.desc': '暗く温かみのある複雑な音色。',
    'product.mouth.modern.desc': '明るい音色、倍音が強調されます。',
    'product.selectCustomization': 'カスタマイズオプションを選択',
    'product.endplug.plain': '単色 1色',
    'product.endplug.twocolor': '2色 / マーブル',
    'product.endplug.custom': 'カスタム / 動物モデル',
    'product.endplug.note': 'ソプラノ、アルト、テナー、バリトンは同価格です',
  'nav.home': 'ホーム',
  'nav.about': '私たちについて',
  'nav.products': '製品',
  'nav.services': '修理サービス',

  'cart.title': 'カート',
  'cart.quantity': '数量',
  'cart.empty': 'カートは空です',
  'cart.total': '合計',
  'cart.checkout': '購入手続きへ',
  'cart.processing': '処理中...',

  // product / purchase labels
  'product.selectToneHole': 'トーンホールのサイズを選択',
  'product.selectMouthpiece': 'マウスピースの種類を選択',
  'product.totalPrice': '合計金額',
  'product.tone.standard': '標準',
  'product.tone.large': 'ラージ',
  'product.mouth.balance': 'バランス',
  'product.mouth.traditional': 'トラディショナル',
  'product.mouth.modern': 'モダン',
  'addtocart.add': 'カートに追加 - {price} {currency}',
  'addtocart.added': '追加しました！',
    'booking.estimated': '推定価格',

  'hero.mission': '革新的な楽器と、丁寧なリペアを。',
  'hero.title.crafting': '音の',
  'hero.title.joy': 'よろこびを',
  'hero.title.through': '丁寧に',
  'hero.title.perfection': '磨き続ける',

  'hero.desc':
    'どれだけ時間と手間がかかっても、一つひとつ丁寧に向き合い、本当に良いと思えるものだけをお届けしたいと考えています。世界中の学生の方々や演奏家の皆さまへ向けて、楽器・アクセサリー・リペアサービスをご提供しています。',

  'hero.cta1': '製品を見る',
  'hero.cta2': 'サービスを見る',
  'hero.scroll': 'スクロール',

  'home.philosophy.title':
    '<span class="font-bold italic text-white">「音楽のよろこび」</span>を大切に',

  'home.philosophy.p1':
    '<span class="font italic text-white">「サヌック」</span>—— 人生には“楽しさ”が大切だというタイの考え方です。私たちもその想いを大切にしています。音楽や楽器には、人の心を動かし、日々を少し豊かにする力があると信じています。',

  'home.philosophy.p2':
    'その想いを少しでも形にするために、<span class="font italic text-white">日本の「こだわり」の精神</span>を大切にしています。細かな部分まで丁寧に向き合い、奏者の方にも聴いてくださる方にも、心地よい音を届けられるよう努めています。',

  'home.philosophy.link': '私たちについて',

  'home.masterpieces.subtitle': '丁寧な仕上がり',
  'home.masterpieces.title': '製品',

  'home.shakuhachi.title': 'モダン尺八',
  'home.shakuhachi.desc':
    '現代的なデザインと、伝統的な音色を大切に。邦楽の世界にとどまらず、「みんなの尺八」。より多くの方に親しんでいただける尺八を目指しています。',

  'home.viewdetail': '詳細を見る',

  'home.pads.title': '高性能オクターブパッド',
  'home.pads.desc': '繊細な反応と、自然な吹き心地を。',

  'home.repair.title': '木管リペア',
  'home.repair.desc':
    '大切な楽器を、心を込めて整えます。',

  'home.viewall': 'すべての製品を見る',

  'home.cta.title':
    'あなたらしい音を、一緒に探してみませんか。',
  'home.cta.button': '詳しく見る',

  'about.subtitle': '私たちについて',

  'about.title':
    '<span class="text-4xl md:text-5xl block">楽器づくりと、<br>木管リペアに向き合っています。</span>',

  'about.desc1':
    'バンコク・サトーン地区を拠点に活動しています。',

  'about.desc2':
    '台湾でのリペア研修や、10年以上にわたる経験を通して、一つひとつの楽器と丁寧に向き合ってきました。音色や吹奏感、その楽器らしさを大切にしながら、日々技術を磨いています。初心者の方から演奏活動をされている方まで、それぞれに合った製品やサービスをご提供できるよう努めています。リペアや調整も、奏者の方と楽器、それぞれの個性を大切にしながら行っています。',

  'about.tailor.title':
    '長く愛される価値を目指して',

  'about.tailor.p1':
    '私たちは、もっと多くの方に音楽を身近に感じていただきたいと考えています。知識や技術を磨き続けることで、音楽を始めたい方や楽しみたい方のお力になれれば幸いです。',

  'about.tailor.p2':
    '楽器や音楽を通して、心に残る体験をお届けできるよう努めています。',

  'about.quote':
    '「地球に価値を残す。<br/><span class="italic text-neutral-400">それが、本当の歴史になる。</span>」',

  'about.btn.products': '製品を見る',
  'about.btn.repair': '修理サービスを見る',
  },

  'zh-CN': {
    "cart.limit": "已超出购物车限制，请减少商品后重试。",
    "flow.account": "账户",
    "flow.login": "登录",
    "flow.loginHelp": "登录以管理个人资料、预约和订单。",
    "flow.unavailable": "服务暂不可用，请稍后重试。",
    "flow.retry": "重试",
    "flow.signInRequired": "请先登录。",
    "flow.loading": "加载中…",
    "flow.saving": "正在保存…",
    "flow.saved": "已保存",
    "flow.save": "保存更改",
    "flow.failed": "未能完成请求。已保留您的输入，请重试。",
    "flow.stock": "商品缺货或已预留，请检查购物车后重试。",
    "flow.storage": "请允许浏览器存储，以保留购物车和结账重试信息。",
    "flow.attemptLimit": "尚未解决的结账过多。开始新的付款前请联系我们。",
    "flow.close": "关闭",
    "flow.remove": "移除商品",
    "flow.menu": "打开菜单",
    "flow.language": "选择语言",
    "flow.cart": "打开购物车",
    "flow.name": "姓名",
    "flow.phone": "电话号码",
    "flow.email": "电子邮箱",
    "flow.emailHelp": "此邮箱用于登录，无法在此处更改。",
    "flow.signOut": "退出登录",
    "flow.orders": "订单",
    "flow.bookings": "预约",
    "flow.empty": "暂无记录。",
    "flow.book": "预约维修",
    "flow.payment": "付款状态",
    "flow.pending": "正在等待付款确认，请稍后查看。",
    "flow.paid": "付款已确认",
    "flow.expired": "结账已过期，库存释放由支付服务确认。",
    "flow.review": "此订单需要卖家审核，请在再次付款前联系我们。",
    "flow.unknown": "未找到属于您的订单，无法确认付款。",
    "flow.cancelled": "结账已关闭。已保存的购物车仍可使用，此页不会更改付款或库存预留。",
    "flow.shop": "继续购物",
    "flow.address": "如配送地址需要处理，请联系卖家。付款确认不代表已发货。",
    "flow.shippingAddress": "收货地址",
    "flow.shippingAddressHelp": "将收货地址保存到账户中。清空所有字段即可删除地址。",
    "flow.addressLine1": "街道地址",
    "flow.addressLine2": "公寓、套房等（可选）",
    "flow.addressCity": "城市",
    "flow.addressState": "州 / 省（可选）",
    "flow.addressPostalCode": "邮政编码",
    "flow.addressCountry": "国家代码（ISO 3166-1 alpha-2）",
    "flow.manageBookings": "管理维修预约",
    "flow.manageBookingsHelp": "修改或取消即将到来的维修预约。",
    "booking.service": "服务",
    "booking.time": "时间",
    "booking.details": "详情",
    "booking.next": "下一步",
    "booking.back": "上一步",
    "booking.confirm": "确认预约",
    "booking.select": "请选择乐器、服务和可用时间。",
    "booking.notes": "状况说明（可选）",
    "booking.photoHelp": "请在备注中描述状况，此表单不上传照片。",
    "booking.estimateHelp": "这是泰铢维修参考价，最终报价需检查后确定，不是结账费用。",
    "booking.assessment": "检查后报价",
    "booking.none": "暂无可预约时间，请稍后查看。",
    "booking.collision": "该时段刚被预约，请选择其他时间。",
    "booking.confirmed": "预约已保存，邮件和日历更新可能仍在排队。",
    "booking.availabilityTitle": "可预约的维修时段",
    "booking.calendarLinked": "可预约时段已与维修日历同步。",
    "booking.calendarFallback": "日历尚未连接，目前仅排除网站上的预约。",
    "booking.availabilityHelp": "时间均为泰国曼谷时间（UTC+7）。",
    "booking.manageTitle": "管理维修预约",
    "booking.reschedule": "更改预约时间",
    "booking.cancel": "取消预约",
    "booking.cancelConfirm": "要取消此维修预约吗？",
    "booking.saveTime": "保存新时间",
    "booking.timeUpdated": "预约时间已更新，日历同步可能需要几分钟。",
    "booking.cancelledStatus": "预约已取消，日历同步可能需要几分钟。",
    "booking.modifyUnavailable": "此预约无法再通过网站修改。",
    "booking.calendarSourceError": "无法读取日历空闲时间，请稍后重试。",
    "booking.calendarSetupNeeded": "日历尚未连接。",
    "booking.noManageable": "没有可在线修改的未来预约。",
    "booking.soprano": "高音萨克斯",
    "booking.alto": "中音萨克斯",
    "booking.tenor": "次中音萨克斯",
    "booking.baritone": "上低音萨克斯",
    "booking.bassoon": "巴松",
    "booking.other": "其他",
    "booking.basic": "基础调整",
    "booking.standard": "标准维修",
    "booking.overhaul": "全面翻修",
    "booking.assessmentLabel": "检测评估",
      'product.tone.standard.desc': '紧凑、清晰的音色。易于控制音高。',
      'product.tone.large.desc': '饱满、富有表现力的音色。小手指不推荐使用。',
      'product.mouth.balance.desc': '标准且清晰的音色。适合初学者。',
      'product.mouth.traditional.desc': '沉稳、温暖且复杂的音色。',
      'product.mouth.modern.desc': '明亮的音色，增强的泛音。',
      'product.selectCustomization': '选择定制选项',
      'product.endplug.plain': '单色 1 色',
      'product.endplug.twocolor': '2 色 / 大理石纹',
      'product.endplug.custom': '定制 / 动物模型',
      'product.endplug.note': '高音萨克斯、中音、次中音、低音均为相同价格',
    'nav.home': '首页',
    'nav.about': '关于我们',
    'nav.products': '产品',
    'nav.services': '维修服务',

    'cart.title': '购物车',
    'cart.quantity': '数量',
    'cart.empty': '购物车为空',
    'cart.total': '总计',
    'cart.checkout': '结算',
    'cart.processing': '处理中...',

      // product / purchase labels
      'product.selectToneHole': '选择音孔尺寸',
      'product.selectMouthpiece': '选择吹口类型',
      'product.totalPrice': '总价',
      'product.tone.standard': '标准',
      'product.tone.large': '大',
      'product.mouth.balance': '平衡',
      'product.mouth.traditional': '传统',
      'product.mouth.modern': '现代',
      'addtocart.add': '加入购物车 - {price} {currency}',
      'addtocart.added': '已加入！',
      'booking.estimated': '预计价格',

    'hero.mission': '创新乐器，卓越匠修。',
    'hero.title.crafting': '以',
    'hero.title.joy': '“完美”',
    'hero.title.through': '成就',
    'hero.title.perfection': '“喜悦”',

    'hero.desc':
      '无论耗费多少时间与心力，我们始终坚持只呈现真正优秀的作品与服务。为世界各地的学生与演奏者提供高品质乐器、配件与专业维修服务。',

    'hero.cta1': '探索产品',
    'hero.cta2': '了解服务',
    'hero.scroll': '滑动',

    'home.philosophy.title':
      '<span class="font-bold italic text-white">“音乐中的喜悦”</span>的共鸣',

    'home.philosophy.p1':
      '<span class="font italic text-white">“Sanuk”</span> 是泰国文化中“快乐是生活不可或缺的一部分”的理念。我们珍视这样的价值，也希望将这份喜悦分享给世界。我们相信，音乐与乐器拥有连接人与社会、让世界变得更加美好的力量。',

    'home.philosophy.p2':
      '为了实现这一理念，<span class="font italic text-white">我们秉承日本“こだわり（Kodawari）”的匠人精神</span>，坚持对细节毫不妥协。通过不断打磨每一个细微之处，让每一个音符都能为演奏者与听众带来更深层的感动。',

    'home.philosophy.link': '阅读我们的故事',

    'home.masterpieces.subtitle': '产品',
    'home.masterpieces.title': '精湛工艺',

    'home.shakuhachi.title': '现代尺八',
    'home.shakuhachi.desc':
      '现代创新设计与传统音色的融合。<br/>属于每个人的尺八。',

    'home.viewdetail': '查看详情',

    'home.pads.title': '高精度垫片',
    'home.pads.desc':
      '音色清晰通透，演奏轻松自然。',

    'home.repair.title': '专业维修',
    'home.repair.desc':
      '让您珍爱的乐器重焕新生。',

    'home.viewall': '查看全部产品',

    'home.cta.title':
      '准备好塑造属于你的声音了吗？',

    'home.cta.button': '开启旅程',

    'about.subtitle': '关于我们',

    'about.title':
      '<span class="text-4xl md:text-5xl block">乐器创新者，<br>木管乐器维修专家</span>',

    'about.desc1':
      '位于泰国曼谷沙吞区。',

    'about.desc2':
      '凭借在台湾接受的专业维修训练，以及十余年的实践经验，我们始终专注于打磨每一件乐器的音色、响应与个性。我们的产品面向所有层级的演奏者——从初学者到追求细腻表现的专业音乐家。每一次维修与调整，都会根据演奏者与乐器本身的特点细心定制，尊重每一件乐器独有的声音。',

    'about.tailor.title':
      '创造真正具有价值的传承',

    'about.tailor.p1':
      '我们希望让音乐变得更加触手可及。我们相信，知识与工艺能够打破界限，为所有热爱音乐的人带来新的可能性。',

    'about.tailor.p2':
      '我们致力于创造超越音乐本身、真正打动人心的体验。',

    'about.quote':
      '“为世界留下真正的价值。<br/><span class="italic text-neutral-400">这才是真正的传承。</span>”',

    'about.btn.products': '查看产品',
    'about.btn.repair': '查看维修服务',
  },

  th: {
    "cart.limit": "เกินขีดจำกัดตะกร้า โปรดลดจำนวนสินค้า",
    "flow.account": "บัญชี",
    "flow.login": "เข้าสู่ระบบ",
    "flow.loginHelp": "เข้าสู่ระบบเพื่อจัดการข้อมูล การจอง และคำสั่งซื้อ",
    "flow.unavailable": "บริการยังไม่พร้อมใช้งาน โปรดลองใหม่ภายหลัง",
    "flow.retry": "ลองใหม่",
    "flow.signInRequired": "โปรดเข้าสู่ระบบเพื่อดำเนินการต่อ",
    "flow.loading": "กำลังโหลด…",
    "flow.saving": "กำลังบันทึก…",
    "flow.saved": "บันทึกแล้ว",
    "flow.save": "บันทึกการเปลี่ยนแปลง",
    "flow.failed": "ดำเนินการไม่สำเร็จ ข้อมูลยังอยู่ โปรดลองใหม่",
    "flow.stock": "สินค้าหมดหรือถูกจองแล้ว โปรดตรวจสอบตะกร้า",
    "flow.storage": "โปรดอนุญาตพื้นที่จัดเก็บเบราว์เซอร์เพื่อเก็บตะกร้าและข้อมูลลองชำระใหม่",
    "flow.attemptLimit": "มีรายการชำระเงินที่ยังไม่สรุปมากเกินไป โปรดติดต่อเราก่อนเริ่มชำระเงินใหม่",
    "flow.close": "ปิด",
    "flow.remove": "นำสินค้าออก",
    "flow.menu": "เปิดเมนู",
    "flow.language": "เลือกภาษา",
    "flow.cart": "เปิดตะกร้า",
    "flow.name": "ชื่อและนามสกุล",
    "flow.phone": "เบอร์โทรศัพท์",
    "flow.email": "อีเมล",
    "flow.emailHelp": "อีเมลนี้ใช้สำหรับเข้าสู่ระบบและไม่สามารถเปลี่ยนได้ที่นี่",
    "flow.signOut": "ออกจากระบบ",
    "flow.orders": "คำสั่งซื้อ",
    "flow.bookings": "การจอง",
    "flow.empty": "ยังไม่มีรายการ",
    "flow.book": "จองซ่อมเครื่องดนตรี",
    "flow.payment": "สถานะการชำระเงิน",
    "flow.pending": "กำลังรอยืนยันการชำระเงิน โปรดตรวจสอบอีกครั้ง",
    "flow.paid": "ยืนยันการชำระเงินแล้ว",
    "flow.expired": "การชำระเงินหมดอายุ การคืนสต็อกยืนยันโดยผู้ให้บริการชำระเงิน",
    "flow.review": "คำสั่งซื้อนี้ต้องให้ผู้ขายตรวจสอบ โปรดติดต่อก่อนชำระอีกครั้ง",
    "flow.unknown": "ไม่พบคำสั่งซื้อของคุณ จึงยังไม่ยืนยันการชำระเงิน",
    "flow.cancelled": "ปิดหน้าชำระเงินแล้ว ตะกร้าที่บันทึกยังอยู่ หน้านี้ไม่เปลี่ยนการชำระเงินหรือการจองสินค้า",
    "flow.shop": "เลือกสินค้าต่อ",
    "flow.address": "โปรดติดต่อผู้ขายหากต้องตรวจสอบที่อยู่ การยืนยันชำระเงินยังไม่ใช่การยืนยันจัดส่ง",
    "flow.shippingAddress": "ที่อยู่จัดส่ง",
    "flow.shippingAddressHelp": "บันทึกที่อยู่จัดส่งไว้ในบัญชี หากเว้นว่างทุกช่อง ระบบจะลบที่อยู่นี้",
    "flow.addressLine1": "ที่อยู่",
    "flow.addressLine2": "อาคาร ห้องชุด ฯลฯ (ไม่บังคับ)",
    "flow.addressCity": "เมือง",
    "flow.addressState": "จังหวัด / รัฐ (ไม่บังคับ)",
    "flow.addressPostalCode": "รหัสไปรษณีย์",
    "flow.addressCountry": "รหัสประเทศ (ISO 3166-1 alpha-2)",
    "flow.manageBookings": "จัดการนัดหมายซ่อม",
    "flow.manageBookingsHelp": "เปลี่ยนเวลาหรือยกเลิกนัดหมายซ่อมที่กำลังจะมาถึง",
    "booking.service": "บริการ",
    "booking.time": "เวลา",
    "booking.details": "รายละเอียด",
    "booking.next": "ถัดไป",
    "booking.back": "ย้อนกลับ",
    "booking.confirm": "ยืนยันการจอง",
    "booking.select": "เลือกเครื่องดนตรี บริการ และเวลาว่าง",
    "booking.notes": "รายละเอียดอาการ (ไม่บังคับ)",
    "booking.photoHelp": "อธิบายอาการในหมายเหตุ แบบฟอร์มนี้ไม่อัปโหลดรูปภาพ",
    "booking.estimateHelp": "ราคาซ่อมประมาณการเป็นบาท ใบเสนอราคาจริงหลังตรวจ ไม่ใช่ยอดชำระเงิน",
    "booking.assessment": "ประเมินราคาหลังตรวจ",
    "booking.none": "ไม่มีเวลาว่าง โปรดตรวจสอบภายหลัง",
    "booking.collision": "เวลานี้ถูกจองแล้ว โปรดเลือกเวลาอื่น",
    "booking.confirmed": "บันทึกการจองแล้ว อีเมลและปฏิทินอาจยังรออัปเดต",
    "booking.availabilityTitle": "เวลานัดหมายซ่อมที่ว่าง",
    "booking.calendarLinked": "เวลาว่างเชื่อมกับปฏิทินงานซ่อมแล้ว",
    "booking.calendarFallback": "ยังไม่ได้เชื่อมปฏิทิน ขณะนี้แสดงเฉพาะเวลาที่ไม่มีการจองผ่านเว็บไซต์",
    "booking.availabilityHelp": "เวลาแสดงตามเขตเวลาเอเชีย/กรุงเทพฯ (UTC+7)",
    "booking.manageTitle": "จัดการนัดหมายซ่อม",
    "booking.reschedule": "เปลี่ยนเวลานัดหมาย",
    "booking.cancel": "ยกเลิกนัดหมาย",
    "booking.cancelConfirm": "ต้องการยกเลิกนัดหมายซ่อมนี้หรือไม่",
    "booking.saveTime": "บันทึกเวลาใหม่",
    "booking.timeUpdated": "อัปเดตเวลานัดหมายแล้ว ปฏิทินอาจใช้เวลาสักครู่ในการอัปเดต",
    "booking.cancelledStatus": "ยกเลิกนัดหมายแล้ว ปฏิทินอาจใช้เวลาสักครู่ในการอัปเดต",
    "booking.modifyUnavailable": "ไม่สามารถเปลี่ยนการนัดหมายนี้ทางออนไลน์ได้แล้ว",
    "booking.calendarSourceError": "โหลดเวลาว่างจากปฏิทินไม่ได้ โปรดลองอีกครั้งภายหลัง",
    "booking.calendarSetupNeeded": "ยังไม่ได้เชื่อมต่อปฏิทิน",
    "booking.noManageable": "ไม่มีนัดหมายที่กำลังจะมาถึงและสามารถเปลี่ยนทางออนไลน์ได้",
    "booking.soprano": "โซปราโนแซกโซโฟน",
    "booking.alto": "อัลโตแซกโซโฟน",
    "booking.tenor": "เทเนอร์แซกโซโฟน",
    "booking.baritone": "บาริโทนแซกโซโฟน",
    "booking.bassoon": "บาสซูน",
    "booking.other": "อื่น ๆ",
    "booking.basic": "ปรับตั้งพื้นฐาน",
    "booking.standard": "บริการมาตรฐาน",
    "booking.overhaul": "โอเวอร์ฮอล",
    "booking.assessmentLabel": "ตรวจประเมิน",
      'product.tone.standard.desc': 'โทนเสียงคมชัด เหมาะกับการควบคุมระดับเสียงง่าย',
      'product.tone.large.desc': 'โทนเสียงเข้มข้นและแสดงออกได้ดี ไม่แนะนำสำหรับผู้ที่มีนิ้วสั้น',
      'product.mouth.balance.desc': 'เสียงมาตรฐาน ชัดเจน เหมาะสำหรับผู้เริ่มต้น',
      'product.mouth.traditional.desc': 'เสียงทึบ อบอุ่น และมีความซับซ้อน',
      'product.mouth.modern.desc': 'เสียงสว่าง เน้นโทนสูง',
      'product.selectCustomization': 'เลือกตัวเลือกการปรับแต่ง',
      'product.endplug.plain': '1 สีเรียบ',
      'product.endplug.twocolor': '2 สี / ลายหินอ่อน',
      'product.endplug.custom': 'แบบกำหนดเอง / แบบสัตว์',
      'product.endplug.note': 'ราคาเดียวกันสำหรับ Soprano, Alto, Tenor, Baritone',
    'nav.home': 'หน้าแรก',
    'nav.about': 'เกี่ยวกับเรา',
    'nav.products': 'สินค้า',
    'nav.services': 'บริการซ่อม',

    'cart.title': 'ตะกร้าสินค้า',
    'cart.quantity': 'จำนวน',
    'cart.empty': 'ยังไม่มีสินค้าในตะกร้า',
    'cart.total': 'ยอดรวม',
    'cart.checkout': 'ชำระเงิน',
    'cart.processing': 'กำลังดำเนินการ...',

    // product / purchase labels
    'product.selectToneHole': 'เลือกขนาดรูเสียง',
    'product.selectMouthpiece': 'เลือกประเภทปากเป่า',
    'product.totalPrice': 'ราคารวม',
    'product.tone.standard': 'มาตรฐาน',
    'product.tone.large': 'ขนาดใหญ่',
    'product.mouth.balance': 'บาลานซ์',
    'product.mouth.traditional': 'ดั้งเดิม',
    'product.mouth.modern': 'สมัยใหม่',
    'addtocart.add': 'เพิ่มในตะกร้า - {price} {currency}',
    'addtocart.added': 'เพิ่มแล้ว!',
    'booking.estimated': 'ราคาประมาณ',

    'hero.mission':
      'นวัตกรรมในเครื่องดนตรี และงานซ่อมระดับมืออาชีพ',

    'hero.title.crafting': 'สร้าง',
    'hero.title.joy': '"ความสุขจากการเล่นดนตรี"',
    'hero.title.through': 'ผ่าน',
    'hero.title.perfection': '"ความสมบูรณ์แบบ"',

    'hero.desc':
      'ไม่ว่าจะต้องใช้เวลาและความทุ่มเทมากเพียงใด เรามุ่งมั่นสร้างสรรค์เฉพาะสินค้าและบริการที่ดีที่สุด เครื่องดนตรี อุปกรณ์เสริม และงานซ่อมคุณภาพสูงสำหรับนักเรียนและนักดนตรีทั่วโลก',

    'hero.cta1': 'ค้นพบสินค้าของเรา',
    'hero.cta2': 'สำรวจบริการ',
    'hero.scroll': 'เลื่อนลง',

    'home.philosophy.title':
      'เสียงกังวาลของ <span class="font-bold italic text-white">"ความสุขในดนตรี"</span>',

    'home.philosophy.p1':
      '<span class="font italic text-white">"สนุก"</span> คือแนวคิดแบบไทยที่เชื่อว่าความสุขเป็นส่วนสำคัญของชีวิต เราให้คุณค่ากับสิ่งนี้ และอยากส่งต่อความสุขนั้นไปสู่ผู้คนทั่วโลก เราเชื่อว่าเสียงดนตรีและเครื่องดนตรีสามารถเชื่อมโยงผู้คน เติมพลังใจ และทำให้สังคมดีขึ้นได้',

    'home.philosophy.p2':
      'เพื่อถ่ายทอดแนวคิดนี้ออกมาให้ดีที่สุด <span class="font italic text-white">เรายึดถือจิตวิญญาณ “Kodawari” ของญี่ปุ่น</span> — ความพิถีพิถันที่ไม่ประนีประนอมในทุกรายละเอียด เราเชื่อว่าการใส่ใจแม้แต่จุดเล็กที่สุด จะทำให้ทุกเสียงที่บรรเลงส่งต่อความสุขได้อย่างแท้จริง',

    'home.philosophy.link': 'เรื่องราวของเรา',

    'home.masterpieces.subtitle': 'สินค้า',
    'home.masterpieces.title': 'งานฝีมืออันประณีต',

    'home.shakuhachi.title': 'ชากุฮาจิสมัยใหม่',
    'home.shakuhachi.desc':
      'การออกแบบร่วมสมัย ผสานกับเอกลักษณ์เสียงแบบดั้งเดิม<br/>“เครื่องดนตรีสำหรับทุกคน”',

    'home.viewdetail': 'ดูรายละเอียด',

    'home.pads.title': 'นวมซิลิโคนคุณภาพสูง',
    'home.pads.desc':
      'ทุกโน้ตชัดเจน ควบคุมได้อย่างเป็นธรรมชาติ',

    'home.repair.title': 'บริการซ่อมโดยผู้เชี่ยวชาญ',
    'home.repair.desc':
      'คืนชีวิตใหม่ให้กับเครื่องดนตรีที่คุณรัก',

    'home.viewall': 'ดูสินค้าทั้งหมด',

    'home.cta.title':
      'พร้อมออกแบบเสียงในแบบของคุณแล้วหรือยัง?',
    'home.cta.button': 'เริ่มต้นการเดินทาง',

    'about.subtitle': 'เกี่ยวกับเรา',

    'about.title':
      '<span class="text-4xl md:text-5xl block">ผู้สร้างนวัตกรรมเครื่องดนตรี <br> และผู้เชี่ยวชาญด้านการซ่อมเครื่องเป่าลมไม้</span>',

    'about.desc1':
      'ตั้งอยู่ในย่านสาทร กรุงเทพมหานคร',

    'about.desc2':
      'ด้วยการฝึกอบรมด้านการซ่อมอย่างเข้มข้นในไต้หวัน, การเรียนวิศวกรรมอย่างเข้มข้นจากมหาลัยชั้นนำของญี่ปุ่น และประสบการณ์จริงกว่า 10 ปี พวกเราทุ่มเทให้กับการพัฒนาเสียง การตอบสนอง และเอกลักษณ์ของเครื่องดนตรีแต่ละชิ้น ผลิตภัณฑ์ของเราถูกออกแบบมาเพื่อนักดนตรีทุกระดับ ตั้งแต่ผู้เริ่มต้นไปจนถึงมืออาชีพที่ต้องการความละเอียดอ่อนในการควบคุม ทุกบริการและการซ่อมได้รับการปรับแต่งอย่างพิถีพิถัน เพื่อให้เหมาะกับทั้งตัวผู้เล่นและตัวเครื่องดนตรีอย่างแท้จริง',

    'about.tailor.title':
      'สร้างคุณค่าที่ส่งต่อไปได้ในระยะยาว',

    'about.tailor.p1':
      'เราต้องการให้ดนตรีเป็นสิ่งที่ทุกคนเข้าถึงได้ เพราะเราเชื่อว่าความรู้และงานฝีมือสามารถเปิดโอกาสใหม่ ๆ ให้กับทุกคนที่อยากเล่นดนตรี',

    'about.tailor.p2':
      'เรามุ่งมั่นสร้างประสบการณ์ที่มีความหมายผ่านเครื่องดนตรี',

    'about.quote':
      '"สร้างคุณค่าทิ้งไว้บนโลกใบนี้<br/><span class="italic text-neutral-400">นั่นคือประวัติศาสตร์ที่แท้จริง</span>"',

    'about.btn.products': 'ดูสินค้าของเรา',
    'about.btn.repair': 'ดูบริการซ่อม',
  },
} as const;
