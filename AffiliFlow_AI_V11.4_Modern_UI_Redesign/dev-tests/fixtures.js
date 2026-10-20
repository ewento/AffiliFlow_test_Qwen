// Fixtures for the Mini Massage Gun smoke test. No live AI is involved: these stand in for model output.
const LONG_NAME = 'Mini Massage Gun Wireless Massage Gun Muscle Relaxation Massage Equipment';

const intel = {
  name: LONG_NAME, shortName: 'Mini Massage Gun', category: 'Alat urut mini',
  audience: 'Orang yang banyak duduk, berdiri atau memandu dan mahu peneman rehat yang mudah dibawa',
  visibleFacts: ['Tajuk produk menyebut "Mini" dan "Wireless"', 'Reka bentuk padat berbentuk pemegang'],
  useContexts: ['Perjalanan jauh', 'Rehat selepas hari yang panjang'],
  visualIdentity: ['Saiz mini', 'Tanpa wayar'],
  uncertain: ['Kuasa, tahap kelajuan, tempoh bateri, bunyi, berat dan bilangan kepala tidak dinyatakan']
};

// Ten genuinely different posts (no invented experiences, no health claims, spaced hashtags in array only).
const goodPosts = [
 { id:1, slot:'morning', time:'8:00 AM', platforms:['Facebook','Threads'], angle:'Soalan jujur pembeli', context:'pemandu e-hailing', hookType:'soalan', ctaType:'soalan dalam komen', visualDetail:'saiz mini',
  facebook:'Mini atau saiz biasa? Soalan ni sentiasa muncul bila orang nak beli alat urut. Bagi pemandu e-hailing dan penghantar barang yang menghabiskan hari dalam kereta atau atas motor, saiz memang jadi bahan timbang sebab ruang dalam beg dan dashboard terhad. Mini Massage Gun ni berbentuk padat dan tanpa wayar, jadi senang dimasukkan ke dalam beg sandang tanpa rasa menyusahkan. Tapi jujurlah, saiz kecil bukan jawapan untuk semua orang. Ada yang lebih suka yang besar dan berat. Jadi sebelum tekan beli, tanya dulu: nak guna di mana, dan selalu ke tak? Kalau jawapannya "senang bawa ke mana-mana", mungkin ia layak masuk senarai pendek anda. Ada soalan tentang saiz atau cara guna? Tinggalkan di bawah, kita bincang sama-sama.',
  threads:'Mini atau saiz biasa? Untuk pemandu dan penghantar barang, saiz memang penting. Mini Massage Gun ni padat dan tanpa wayar. Ada soalan sebelum beli? Tanya kat sini.',
  x:'Mini atau saiz biasa? Bagi yang banyak di jalan raya, saiz padat ni boleh jadi pertimbangan. Ada soalan? Tanya je.',
  hashtags:['minimassagegun','pemanduegrab','alaturuminimi','tipsbeli'] },
 { id:2, slot:'morning', time:'8:00 AM', platforms:['Facebook','Threads'], angle:'Senario hipotetikal', context:'balik kampung', hookType:'senario', ctaType:'tag kawan', visualDetail:'tanpa wayar',
  facebook:'Bayangkan ini: jalan balik kampung sesak, berjam-jam duduk dalam kereta, dan bila sampai rumah mak semua orang nak terus baring. Situasi macam ni jadi kebiasaan setiap musim perayaan. Kalau ada satu benda kecil dalam beg yang boleh jadi peneman rehat lepas perjalanan jauh, tentu lebih selesa. Mini Massage Gun muat dalam ruang beg yang sempit sebab bersaiz mini, dan sifatnya tanpa wayar jadi tak bergantung pada sambungan kabel ketika digunakan. Tak perlu menggeledah beg besar, letak je di tepi pakaian. Tag seorang kawan yang selalu jadi pemandu tetap setiap kali balik kampung. Mungkin dia suka idea ni.',
  threads:'Bayangkan sampai rumah mak lepas pemanduan jauh, semua nak baring. Alat kecil tanpa wayar macam ni senang diselit dalam beg. Tag kawan yang selalu jadi pemandu tetap.',
  x:'Balik kampung berjam-jam di jalan? Alat mini tanpa wayar senang diselit dalam beg. Tag pemandu tetap anda.',
  hashtags:['balikkampung','minimassagegun','roadtrip','pemanduutama'] },
 { id:3, slot:'lunch', time:'1:00 PM', platforms:['Facebook','X'], angle:'Senarai semak sebelum beli', context:'asrama / kolej', hookType:'senarai nombor', ctaType:'simpan post', visualDetail:'maklumat pada halaman produk',
  facebook:'3 perkara untuk disemak sebelum beli alat urut mini untuk bilik asrama. Satu, ruang. Meja belajar dan loker asrama biasanya sempit, jadi saiz kecil memang membantu. Dua, cara cas. Semak jenis pengecas yang diperlukan dan pastikan anda ada kabel atau palam yang sesuai. Tiga, butiran produk. Baca penerangan di halaman, jangan hanya percaya gambar semata-mata. Mini Massage Gun ni menepati senarai pertama sebab saiznya mini dan tanpa wayar, tetapi dua lagi tu tetap kena anda semak sendiri. Simpan post ni sebagai senarai semak, dan banding dengan pilihan lain sebelum buat keputusan.',
  threads:'3 benda nak semak sebelum beli alat urut mini untuk asrama: ruang, cara cas, dan butiran produk. Simpan sebagai senarai semak.',
  x:'Beli alat mini untuk asrama? Semak 3 perkara: ruang, cara cas, butiran produk. Simpan senarai ni.',
  hashtags:['pelajarkolej','tipsasrama','minimassagegun','senaraisemak'] },
 { id:4, slot:'lunch', time:'1:00 PM', platforms:['Facebook','X'], angle:'Perhatikan reka bentuk dalam gambar', context:'Sabtu gotong-royong di rumah', hookType:'fakta visual', ctaType:'semak gambar penuh', visualDetail:'reka bentuk padat dalam gambar',
  facebook:'Cuba zoom gambar produk ni dan perhatikan reka bentuknya. Bentuknya padat, nampak mudah dipegang, dan saiz mini itu memang jadi tarikan utama. Hari Sabtu biasanya hari gotong-royong rumah: mop lantai, lap tingkap, susun balik almari. Selepas semua tu siap, benda yang orang cari adalah masa untuk duduk dan rehat. Alat kecil macam ni senang disimpan di dalam laci ruang tamu dan dicapai bila perlu. Kami tak akan tambah apa-apa spesifikasi yang tak tertera. Jadi lihat sendiri gambar penuh dan butiran di halaman produk, kemudian putuskan sama ada ia padan dengan rutin rumah anda.',
  threads:'Zoom gambar ni dan lihat bentuknya yang padat. Selepas gotong-royong hari Sabtu, alat kecil mudah disimpan dalam laci. Gambar penuh ada di halaman produk.',
  x:'Reka bentuk padat, saiz mini. Lihat gambar penuh dan butiran di halaman produk sebelum putuskan.',
  hashtags:['gotongroyong','kemasrumah','minimassagegun','hariSabtu'] },
 { id:5, slot:'evening', time:'8:00 PM', platforms:['Facebook','Threads','X'], angle:'Hadiah untuk orang tersayang', context:'hari jadi ayah', hookType:'untuk yang...', ctaType:'semak harga dan butiran', visualDetail:'saiz mini sesuai untuk dibungkus',
  facebook:'Untuk anda yang pening setiap kali nak cari hadiah hari jadi ayah. Ayah biasanya cakap "tak payah susah-susah", tapi tetap tersenyum bila ada yang mengingatinya. Hadiah yang kecil dan praktikal selalunya lebih mudah diterima. Mini Massage Gun bersaiz mini, jadi senang dibungkus dan disimpan, dan tanpa wayar bermakna ayah boleh letak di mana-mana sudut rumah. Tentu saja, hadiah paling bermakna ialah ucapan dan masa bersama. Alat ini hanya pelengkap kecil. Semak harga dan butiran produk di pautan di bawah sebelum anda tentukan.',
  threads:'Hadiah hari jadi ayah? Yang kecil dan praktikal selalunya lebih senang diterima. Mini Massage Gun saiz mini, senang dibungkus. Semak harga dan butiran di pautan.',
  x:'Hadiah ayah yang kecil dan praktikal? Alat mini tanpa wayar ni boleh jadi idea. Semak harga di pautan.',
  hashtags:['hadiahayah','harijadi','idea hadiah','minimassagegun'] },
 { id:6, slot:'evening', time:'8:00 PM', platforms:['Facebook','Threads','X'], angle:'Kesilapan biasa ketika memilih', context:'gym malam', hookType:'pernyataan berani', ctaType:'undi A atau B', visualDetail:'tanpa wayar untuk dibawa ke gym',
  facebook:'Jangan beli alat urut semata-mata sebab nampak comel. Itu kesilapan pertama. Kesilapan kedua ialah tak fikir di mana ia akan digunakan. Orang yang selalu ke gym lepas waktu kerja mungkin mahukan sesuatu yang boleh masuk ke dalam beg sukan, manakala yang lain cuma perlukan satu untuk di rumah. Mini Massage Gun bersaiz mini dan tanpa wayar, jadi ia sesuai dengan keperluan yang pertama. Kalau keperluan anda lain, jangan paksa diri. Soalan mudah untuk anda: bawa ke gym atau tinggal di rumah? Jawab A atau B di bawah.',
  threads:'Jangan beli alat urut hanya sebab comel. Fikir dulu nak guna di mana. Bawa ke gym atau tinggal di rumah? Jawab A atau B.',
  x:'Kesilapan biasa: beli sebab comel, bukan sebab perlu. Bawa ke gym (A) atau simpan di rumah (B)?',
  hashtags:['gymmalaysia','tipspembeli','minimassagegun','beliberhemah'] },
 { id:7, slot:'evening', time:'8:00 PM', platforms:['Facebook','Threads','X'], angle:'Humor ringan', context:'kerja dari rumah di meja makan', hookType:'humor', ctaType:'kongsi jika sesuai', visualDetail:'saiz mini muat atas meja',
  facebook:'Meja makan pagi: pejabat. Meja makan tengah hari: dewan mesyuarat. Meja makan malam: kembali jadi meja makan, tapi kerusi masih rasa macam pejabat. Itulah kehidupan kerja dari rumah. Ramai yang ubah ruang tapi lupa memberi diri rehat yang sebenar. Satu cara ringkas ialah sediakan sesuatu yang kecil di atas meja untuk mengingatkan anda bangun dan bergerak. Mini Massage Gun muat atas meja kerana bersaiz mini, jadi ia tak makan tempat pun. Ketawa dulu, kemudian berehat. Kongsi pada kawan yang masih makan nasi sambil buka laptop.',
  threads:'Meja makan pagi: pejabat. Malam: balik jadi meja makan, tapi kerusi masih rasa pejabat. Alat mini ni tak makan tempat atas meja. Kongsi pada kawan WFH anda.',
  x:'Meja makan: pejabat siang, meja makan malam. Alat mini tak makan tempat. Kongsi pada kawan WFH.',
  hashtags:['kerjadarirumah','wfhmalaysia','minimassagegun','humorkerja'] },
 { id:8, slot:'best', time:'9:00 PM', platforms:['Facebook','Threads','X'], angle:'Rutin malam', context:'pekerja syif malam', hookType:'sapaan kepada kumpulan', ctaType:'tiada tekanan', visualDetail:'tanpa wayar untuk rutin di mana-mana',
  facebook:'Buat pekerja syif dan sesiapa yang sampai rumah lewat malam. Waktu itu rumah sunyi, lampu pun malap. Ramai orang ada rutin kecil sebelum tidur: mandi air suam, minum sesuatu yang hangat, matikan telefon. Kalau anda mahu tambah satu lagi tabiat, pilih sesuatu yang ringkas dan tak mengganggu orang serumah. Mini Massage Gun tanpa wayar dan bersaiz mini, jadi tiada kabel berjuntai di tepi katil. Tak perlu terburu-buru. Fikir dahulu sama ada rutin ini sesuai untuk anda, dan baca butiran produk dengan tenang.',
  threads:'Buat yang sampai rumah lewat malam: tambah satu rutin ringkas sebelum tidur. Alat mini tanpa wayar tiada kabel berjuntai. Tak perlu rushing, fikir dulu.',
  x:'Sampai rumah lewat? Rutin ringkas sebelum tidur. Alat tanpa wayar, tiada kabel. Fikir dulu, tak perlu rushing.',
  hashtags:['syifmalam','rutinmalam','minimassagegun','pekerjakilang'] },
 { id:9, slot:'best', time:'9:00 PM', platforms:['Facebook','Threads','X'], angle:'Sesuai untuk siapa dan siapa boleh skip', context:'melancong ke Cameron Highlands', hookType:'soal jawab', ctaType:'bandingkan sendiri', visualDetail:'saiz mini muat beg kecil',
  facebook:'Sesuai untuk siapa? Orang yang kerap berjalan jauh dan mahu bawa alat kecil dalam beg, contohnya ketika bercuti ke Cameron Highlands, mungkin akan suka saiz mini. Siapa boleh skip? Mereka yang mencari alat besar dengan banyak kepala dan tetapan, sebab maklumat tentang itu tidak dinyatakan untuk Mini Massage Gun. Kami lebih rela anda tahu dari awal. Jadi bandingkan sendiri: tulis tiga perkara yang anda mahukan, kemudian semak sama ada gambar dan butiran produk memenuhinya.',
  threads:'Sesuai untuk siapa? Yang kerap melancong dan mahu bawa alat kecil. Siapa boleh skip? Yang mahu alat besar penuh tetapan. Bandingkan sendiri.',
  x:'Suka bawa alat kecil ketika melancong? Mini ni mungkin sesuai. Mahu yang besar dan penuh tetapan? Boleh skip. Bandingkan sendiri.',
  hashtags:['cuticameron','melancong','minimassagegun','tipsbawabeg'] },
 { id:10, slot:'best', time:'9:00 PM', platforms:['Facebook','Threads','X'], angle:'Soft-sell ringkas', context:'peniaga pasar malam', hookType:'arahan', ctaType:'penunjuk pautan ringkas', visualDetail:'saiz mini dan bentuk padat',
  facebook:'Sebelum checkout, semak dua perkara ni dulu. Pertama, adakah anda mahukan yang kecil dan mudah disimpan? Kedua, adakah anda selesa dengan produk tanpa wayar? Bagi peniaga pasar malam yang berdiri lama dan mengangkut barang setiap petang, ruang bawa memang terhad, jadi saiz mini boleh jadi kelebihan. Kalau kedua-duanya "ya", Mini Massage Gun patut dimasukkan ke dalam senarai tengok. Kalau tidak, tak mengapa, banyak lagi pilihan lain. Butiran dan gambar penuh ada di pautan bawah.',
  threads:'Sebelum checkout: nak yang kecil? selesa tanpa wayar? Kalau ya, masuk senarai tengok. Gambar penuh ada di pautan.',
  x:'Sebelum checkout: nak yang kecil dan tanpa wayar? Kalau ya, layak masuk senarai tengok. Butiran di pautan.',
  hashtags:['pasarmalam','peniagakecil','minimassagegun','sebelumcheckout'] }
];
// fix intentional casing slip in fixture 4 so QA has to normalise tags
goodPosts[3].hashtags[3] = 'hariSabtu';

const videoIdeas = [1,2,3,4,5,6].map(i => ({ id:i, title:'Idea video '+i, concept:'Konsep '+i,
  clipA:'Use the uploaded product reference images to keep the exact product identity. Scene '+i+', clip A.',
  clipB:'Continue from clip A with the same product and lighting. Scene '+i+', clip B.' }));

const goodResult = { productIntelligence: intel, slashCommandsSelected: [], posts: goodPosts, videoIdeas };

// Reproduces what the functional test complained about.
function badPosts() {
  const people = ['Abang saya bawa balik', 'Awal minggu lepas saya ada', 'Saya pernah guna', 'Kawan saya cakap'];
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1, slot: ['morning','lunch','evening','best'][i % 4], time: '8:00 AM', platforms: ['Facebook'],
    angle: 'Sakit leher office', context: 'office laptop badminton', hookType: 'soalan', ctaType: 'link komen', visualDetail: '',
    facebook: `Pernah tak korang rasa leher kaku lepas kerja office depan laptop? ${people[i % 4]} ${LONG_NAME} dan ${LONG_NAME} terbukti merawat sakit otot, terus hilang sakit lepas main badminton. Punca sakit ialah otot tegang. Boleh tengok link dekat ruangan komen.`,
    threads: `Pernah tak korang sakit badan? ${LONG_NAME} merawat. Boleh tengok link dekat ruangan komen.`,
    x: `Pernah tak korang sakit? ${LONG_NAME}. Boleh tengok link dekat ruangan komen. #badmintonmalaysia#sakitbadan#minimassagegunwirelessmassagegunmusclerelaxationmassageequipment`,
    hashtags: ['#badmintonmalaysia#sakitbadan', '#minimassagegunwirelessmassagegunmusclerelaxationmassageequipment']
  }));
}
module.exports = { LONG_NAME, goodResult, badPosts, intel };
