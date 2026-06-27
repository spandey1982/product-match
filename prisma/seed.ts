import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "demo@productmatch.ai";
const DEMO_PASSWORD = "demo1234";

function arr(items: string[]): string {
  return JSON.stringify(items);
}

const products = [
  // ── SAREES ──
  {
    title: "Banarasi Silk Saree in Crimson Red & Antique Gold",
    description: "Handwoven Banarasi silk with intricate zari work. Perfect for weddings and festive occasions.",
    category: "Saree", subcategory: "Bridal Saree", color: "Red",
    colors: arr(["Red", "Gold"]), occasion: arr(["Wedding", "Bridal", "Festive"]),
    styleTags: arr(["Traditional", "Bridal", "Royal"]), material: "Banarasi",
    gender: "WOMEN", season: arr(["Winter", "All Season"]), price: 28500,
  },
  {
    title: "Kanjivaram Pure Silk Saree in Peacock Blue",
    description: "Authentic Kanjivaram silk with golden zari border. A timeless classic.",
    category: "Saree", subcategory: "Kanjivaram Saree", color: "Blue",
    colors: arr(["Blue", "Gold"]), occasion: arr(["Wedding", "Festive", "Religious"]),
    styleTags: arr(["Traditional", "Ethnic", "Royal"]), material: "Kanjeevaram",
    gender: "WOMEN", season: arr(["All Season"]), price: 32000,
  },
  {
    title: "Chiffon Floral Print Saree in Dusty Pink",
    description: "Lightweight chiffon saree with delicate floral prints. Great for day events.",
    category: "Saree", subcategory: "Printed Saree", color: "Pink",
    colors: arr(["Pink", "White"]), occasion: arr(["Party", "Casual", "Festive"]),
    styleTags: arr(["Contemporary", "Casual", "Boho"]), material: "Chiffon",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 4200,
  },
  {
    title: "Banarasi Organza Saree in Mint Green",
    description: "Sheer organza saree with Banarasi weave. Elegant and airy.",
    category: "Saree", subcategory: "Organza Saree", color: "Green",
    colors: arr(["Green", "Gold"]), occasion: arr(["Wedding", "Festive", "Party"]),
    styleTags: arr(["Contemporary", "Fusion", "Festive"]), material: "Organza",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 15800,
  },
  {
    title: "Linen Saree in Saffron Yellow",
    description: "Handloom linen saree. Comfortable and eco-friendly for everyday wear.",
    category: "Saree", subcategory: "Handloom Saree", color: "Yellow",
    colors: arr(["Yellow", "Orange"]), occasion: arr(["Casual", "Office", "Festive"]),
    styleTags: arr(["Minimalist", "Ethnic", "Casual"]), material: "Linen",
    gender: "WOMEN", season: arr(["Summer", "All Season"]), price: 2800,
  },
  {
    title: "Tussar Silk Saree in Earthy Beige",
    description: "Natural tussar silk with tribal embroidery. A celebration of Indian craft.",
    category: "Saree", subcategory: "Silk Saree", color: "Beige",
    colors: arr(["Beige", "Brown"]), occasion: arr(["Casual", "Festive", "Religious"]),
    styleTags: arr(["Ethnic", "Boho", "Traditional"]), material: "Silk",
    gender: "WOMEN", season: arr(["Autumn", "Winter"]), price: 8500,
  },
  {
    title: "Georgette Embroidered Saree in Royal Maroon",
    description: "Heavy georgette saree with intricate thread embroidery. Statement piece.",
    category: "Saree", subcategory: "Designer Saree", color: "Maroon",
    colors: arr(["Maroon", "Gold"]), occasion: arr(["Wedding", "Party", "Anniversary"]),
    styleTags: arr(["Bridal", "Royal", "Traditional"]), material: "Georgette",
    gender: "WOMEN", season: arr(["Winter", "Autumn"]), price: 18900,
  },
  {
    title: "Patola Silk Saree in Vibrant Multicolor",
    description: "Double ikat patola saree from Gujarat. A collector's piece of Indian craft.",
    category: "Saree", subcategory: "Patola Saree", color: "Multicolor",
    colors: arr(["Red", "Green", "Yellow"]), occasion: arr(["Wedding", "Festive"]),
    styleTags: arr(["Traditional", "Royal", "Ethnic"]), material: "Silk",
    gender: "WOMEN", season: arr(["All Season"]), price: 42000,
  },
  {
    title: "Bandhani Saree in Yellow & Red",
    description: "Traditional tie-dye Bandhani from Gujarat. A colorful celebration of Indian art.",
    category: "Saree", subcategory: "Bandhani Saree", color: "Yellow",
    colors: arr(["Yellow", "Red"]), occasion: arr(["Festive", "Traditional", "Casual"]),
    styleTags: arr(["Traditional", "Ethnic", "Festive"]), material: "Cotton",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 5400,
  },
  // ── LEHENGAS ──
  {
    title: "Velvet Bridal Lehenga in Deep Red with Gold Embroidery",
    description: "Luxurious velvet lehenga with hand-embroidered zardozi work. The ultimate bridal statement.",
    category: "Lehenga", subcategory: "Bridal Lehenga", color: "Red",
    colors: arr(["Red", "Gold"]), occasion: arr(["Bridal", "Wedding"]),
    styleTags: arr(["Bridal", "Royal", "Traditional"]), material: "Velvet",
    gender: "WOMEN", season: arr(["Winter", "All Season"]), price: 85000,
  },
  {
    title: "Mirror Work Lehenga in Sky Blue & Silver",
    description: "Festive lehenga with intricate mirror embellishments. Perfect for Navratri.",
    category: "Lehenga", subcategory: "Festive Lehenga", color: "Blue",
    colors: arr(["Blue", "Silver"]), occasion: arr(["Festive", "Party", "Wedding"]),
    styleTags: arr(["Traditional", "Festive", "Ethnic"]), material: "Cotton",
    gender: "WOMEN", season: arr(["All Season"]), price: 12500,
  },
  {
    title: "Pastel Floral Lehenga in Blush Pink",
    description: "Soft and feminine lehenga with 3D floral appliqué work. Great for bridesmaids.",
    category: "Lehenga", subcategory: "Bridesmaid Lehenga", color: "Pink",
    colors: arr(["Pink", "White"]), occasion: arr(["Wedding", "Party"]),
    styleTags: arr(["Contemporary", "Bridal", "Festive"]), material: "Net",
    gender: "WOMEN", season: arr(["Spring", "Summer"]), price: 22000,
  },
  {
    title: "Rajasthani Tie-Dye Lehenga in Multicolor",
    description: "Traditional Bandhej lehenga from Rajasthan. Vibrant and culturally rich.",
    category: "Lehenga", subcategory: "Ethnic Lehenga", color: "Multicolor",
    colors: arr(["Orange", "Red", "Yellow"]), occasion: arr(["Festive", "Casual", "Traditional"]),
    styleTags: arr(["Ethnic", "Boho", "Traditional"]), material: "Cotton",
    gender: "WOMEN", season: arr(["All Season"]), price: 7500,
  },
  {
    title: "Ivory White Lehenga with Silver Thread Work",
    description: "Elegant ivory lehenga for pre-wedding functions.",
    category: "Lehenga", subcategory: "Bridal Lehenga", color: "White",
    colors: arr(["White", "Silver"]), occasion: arr(["Bridal", "Wedding", "Party"]),
    styleTags: arr(["Bridal", "Minimalist", "Contemporary"]), material: "Silk",
    gender: "WOMEN", season: arr(["All Season"]), price: 45000,
  },
  {
    title: "Satin Lehenga in Dusty Rose",
    description: "Fluid satin lehenga with minimal embellishment. Perfect for the modern bride.",
    category: "Lehenga", subcategory: "Contemporary Lehenga", color: "Pink",
    colors: arr(["Pink", "Silver"]), occasion: arr(["Bridal", "Wedding", "Party"]),
    styleTags: arr(["Minimalist", "Contemporary", "Bridal"]), material: "Satin",
    gender: "WOMEN", season: arr(["All Season"]), price: 35000,
  },
  // ── BLOUSES ──
  {
    title: "Brocade Silk Blouse in Antique Gold",
    description: "Heavy brocade blouse with bishop sleeves. Pairs perfectly with silk sarees.",
    category: "Blouse", subcategory: "Designer Blouse", color: "Gold",
    colors: arr(["Gold"]), occasion: arr(["Wedding", "Bridal", "Festive"]),
    styleTags: arr(["Traditional", "Bridal", "Royal"]), material: "Silk",
    gender: "WOMEN", season: arr(["Winter", "All Season"]), price: 4500,
  },
  {
    title: "Mirror & Sequin Blouse in Emerald Green",
    description: "Heavily embellished blouse with mirror work. A showstopper for any festive look.",
    category: "Blouse", subcategory: "Festive Blouse", color: "Green",
    colors: arr(["Green", "Gold"]), occasion: arr(["Festive", "Party", "Wedding"]),
    styleTags: arr(["Festive", "Traditional", "Ethnic"]), material: "Velvet",
    gender: "WOMEN", season: arr(["Winter"]), price: 3800,
  },
  {
    title: "Cotton Printed Blouse in Navy Blue",
    description: "Block-printed cotton blouse. Light and comfortable for everyday saree pairings.",
    category: "Blouse", subcategory: "Casual Blouse", color: "Blue",
    colors: arr(["Blue", "White"]), occasion: arr(["Casual", "Office"]),
    styleTags: arr(["Casual", "Minimalist", "Ethnic"]), material: "Cotton",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 950,
  },
  // ── DUPATTAS ──
  {
    title: "Banarasi Silk Dupatta in Magenta Pink",
    description: "Fine Banarasi silk dupatta with gold zari border. Elevates any ethnic ensemble.",
    category: "Dupatta", subcategory: "Silk Dupatta", color: "Pink",
    colors: arr(["Pink", "Gold"]), occasion: arr(["Wedding", "Festive", "Bridal"]),
    styleTags: arr(["Traditional", "Bridal", "Festive"]), material: "Banarasi",
    gender: "WOMEN", season: arr(["All Season"]), price: 3200,
  },
  {
    title: "Sheer Net Dupatta with Embroidered Borders in Ivory",
    description: "Lightweight net dupatta with delicate embroidery. Versatile and elegant.",
    category: "Dupatta", subcategory: "Net Dupatta", color: "White",
    colors: arr(["White", "Gold"]), occasion: arr(["Wedding", "Party", "Festive"]),
    styleTags: arr(["Minimalist", "Contemporary", "Bridal"]), material: "Net",
    gender: "WOMEN", season: arr(["All Season"]), price: 1800,
  },
  {
    title: "Tie-Dye Chanderi Dupatta in Royal Purple",
    description: "Hand-dyed chanderi silk dupatta. A statement accessory for kurta sets.",
    category: "Dupatta", subcategory: "Chanderi Dupatta", color: "Purple",
    colors: arr(["Purple", "Silver"]), occasion: arr(["Casual", "Festive", "Party"]),
    styleTags: arr(["Boho", "Ethnic", "Festive"]), material: "Silk",
    gender: "WOMEN", season: arr(["Autumn", "Winter"]), price: 2100,
  },
  // ── KURTAS ──
  {
    title: "Chikankari Georgette Kurta in Powder Blue",
    description: "Delicate Lucknawi chikankari embroidery on soft georgette. Classic Indian craftsmanship.",
    category: "Kurta", subcategory: "Embroidered Kurta", color: "Blue",
    colors: arr(["Blue", "White"]), occasion: arr(["Casual", "Festive", "Office"]),
    styleTags: arr(["Traditional", "Ethnic", "Minimalist"]), material: "Georgette",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 3400,
  },
  {
    title: "Silk Angrakha Kurta in Saffron Orange",
    description: "Traditional angrakha-style kurta with tie-front fastening. A regal everyday choice.",
    category: "Kurta", subcategory: "Designer Kurta", color: "Orange",
    colors: arr(["Orange", "Gold"]), occasion: arr(["Festive", "Casual", "Traditional"]),
    styleTags: arr(["Ethnic", "Traditional", "Royal"]), material: "Silk",
    gender: "WOMEN", season: arr(["Autumn", "Winter"]), price: 5200,
  },
  {
    title: "Boho Embroidered Tunic Kurta in White",
    description: "Free-spirited bohemian kurta with mirror and thread embroidery.",
    category: "Kurta", subcategory: "Boho Kurta", color: "White",
    colors: arr(["White", "Multicolor"]), occasion: arr(["Casual", "Festive"]),
    styleTags: arr(["Boho", "Casual", "Ethnic"]), material: "Cotton",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 2800,
  },
  // ── ANARKALIS ──
  {
    title: "Anarkali Suit in Royal Purple with Silver Embroidery",
    description: "Floor-length anarkali with intricate silver thread work. Regal and timeless.",
    category: "Anarkali", subcategory: "Designer Anarkali", color: "Purple",
    colors: arr(["Purple", "Silver"]), occasion: arr(["Wedding", "Party", "Festive"]),
    styleTags: arr(["Royal", "Traditional", "Festive"]), material: "Georgette",
    gender: "WOMEN", season: arr(["Winter", "All Season"]), price: 14500,
  },
  {
    title: "Cotton Anarkali in Teal with Mirror Work",
    description: "Comfortable cotton anarkali with Kutchi mirror embellishments. Boho meets ethnic.",
    category: "Anarkali", subcategory: "Casual Anarkali", color: "Teal",
    colors: arr(["Teal", "Gold"]), occasion: arr(["Casual", "Festive", "Traditional"]),
    styleTags: arr(["Boho", "Ethnic", "Fusion"]), material: "Cotton",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 3800,
  },
  // ── SHARARA ──
  {
    title: "Sharara Set in Lime Green & Gold",
    description: "Heavily embroidered sharara pant with matching kurti. A standout festive ensemble.",
    category: "Sharara", subcategory: "Bridal Sharara", color: "Green",
    colors: arr(["Green", "Gold"]), occasion: arr(["Wedding", "Festive", "Bridal"]),
    styleTags: arr(["Bridal", "Traditional", "Festive"]), material: "Silk",
    gender: "WOMEN", season: arr(["All Season"]), price: 26000,
  },
  {
    title: "Printed Sharara Set in Coral & Ivory",
    description: "Relaxed-fit sharara with floral print kurti. Fusion of comfort and style.",
    category: "Sharara", subcategory: "Casual Sharara", color: "Orange",
    colors: arr(["Orange", "White"]), occasion: arr(["Casual", "Party", "Festive"]),
    styleTags: arr(["Contemporary", "Fusion", "Casual"]), material: "Georgette",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 4200,
  },
  // ── PALAZZO ──
  {
    title: "Handloom Cotton Palazzo in Indigo Blue",
    description: "Flared palazzo pants with traditional block print. Effortlessly stylish.",
    category: "Palazzo", subcategory: "Casual Palazzo", color: "Blue",
    colors: arr(["Blue", "White"]), occasion: arr(["Casual", "Office"]),
    styleTags: arr(["Casual", "Boho", "Minimalist"]), material: "Cotton",
    gender: "WOMEN", season: arr(["Summer", "All Season"]), price: 1600,
  },
  {
    title: "Kalamkari Cotton Palazzo in Earthy Brown",
    description: "Hand-painted Kalamkari palazzo with traditional folk motifs. Art you can wear.",
    category: "Palazzo", subcategory: "Printed Palazzo", color: "Brown",
    colors: arr(["Brown", "Beige"]), occasion: arr(["Casual", "Festive"]),
    styleTags: arr(["Ethnic", "Boho", "Traditional"]), material: "Cotton",
    gender: "WOMEN", season: arr(["All Season"]), price: 2200,
  },
  // ── JEWELLERY ──
  {
    title: "Kundan Bridal Necklace Set in Red & Gold",
    description: "Elaborate Kundan necklace with matching earrings and maang tikka. Bridal essentials.",
    category: "Jewellery", subcategory: "Bridal Necklace", color: "Gold",
    colors: arr(["Gold", "Red"]), occasion: arr(["Bridal", "Wedding", "Festive"]),
    styleTags: arr(["Bridal", "Traditional", "Royal"]), material: "Kundan",
    gender: "WOMEN", season: arr(["All Season"]), price: 18500,
  },
  {
    title: "Temple Jewellery Set in Antique Gold",
    description: "South Indian temple jewellery with ruby and emerald stones. A cultural heirloom.",
    category: "Jewellery", subcategory: "Temple Jewellery", color: "Gold",
    colors: arr(["Gold"]), occasion: arr(["Wedding", "Religious", "Festive"]),
    styleTags: arr(["Traditional", "Royal", "Ethnic"]), material: "Gold",
    gender: "WOMEN", season: arr(["All Season"]), price: 32000,
  },
  {
    title: "Polki Diamond Earrings in Silver & Pearl",
    description: "Uncut polki diamond earrings with pearl drops. Timeless elegance.",
    category: "Jewellery", subcategory: "Earrings", color: "Silver",
    colors: arr(["Silver", "White"]), occasion: arr(["Wedding", "Party", "Festive"]),
    styleTags: arr(["Bridal", "Royal", "Minimalist"]), material: "Silver",
    gender: "WOMEN", season: arr(["All Season"]), price: 8500,
  },
  {
    title: "Jhumka Earrings in Gold & Ruby Red",
    description: "Traditional gold jhumka earrings with ruby stones. A must-have ethnic accessory.",
    category: "Jewellery", subcategory: "Jhumka", color: "Gold",
    colors: arr(["Gold", "Red"]), occasion: arr(["Festive", "Wedding", "Traditional"]),
    styleTags: arr(["Traditional", "Ethnic", "Festive"]), material: "Gold",
    gender: "WOMEN", season: arr(["All Season"]), price: 4200,
  },
  {
    title: "Layered Choker Necklace in Emerald & Gold",
    description: "Multi-layered choker with emerald stones. Makes any ethnic outfit pop.",
    category: "Jewellery", subcategory: "Choker", color: "Gold",
    colors: arr(["Gold", "Green"]), occasion: arr(["Wedding", "Party", "Festive"]),
    styleTags: arr(["Royal", "Festive", "Traditional"]), material: "Gold",
    gender: "WOMEN", season: arr(["All Season"]), price: 12000,
  },
  {
    title: "Silver Oxidized Maang Tikka with Turquoise",
    description: "Boho-ethnic maang tikka in oxidized silver with turquoise stones.",
    category: "Jewellery", subcategory: "Maang Tikka", color: "Silver",
    colors: arr(["Silver", "Teal"]), occasion: arr(["Festive", "Wedding", "Casual"]),
    styleTags: arr(["Boho", "Ethnic", "Fusion"]), material: "Silver",
    gender: "WOMEN", season: arr(["All Season"]), price: 2400,
  },
  {
    title: "Floral Pearl Bracelet Set in Ivory",
    description: "Delicate pearl bracelets set of 4. Elegant accessory for subtle styling.",
    category: "Jewellery", subcategory: "Bracelet", color: "White",
    colors: arr(["White", "Gold"]), occasion: arr(["Wedding", "Party", "Casual"]),
    styleTags: arr(["Minimalist", "Bridal", "Contemporary"]), material: "Pearl",
    gender: "WOMEN", season: arr(["All Season"]), price: 3600,
  },
  {
    title: "Necklace Set in Teal Meenakari & Gold",
    description: "Intricate Rajasthani meenakari necklace in teal and gold. Artistic and bold.",
    category: "Jewellery", subcategory: "Meenakari Jewellery", color: "Teal",
    colors: arr(["Teal", "Gold"]), occasion: arr(["Wedding", "Festive", "Traditional"]),
    styleTags: arr(["Traditional", "Ethnic", "Royal"]), material: "Gold",
    gender: "WOMEN", season: arr(["All Season"]), price: 7800,
  },
  {
    title: "Silk Thread Bangles Set in Coral & Gold",
    description: "Set of 12 silk thread bangles with gold accents. Festive wrist candy.",
    category: "Jewellery", subcategory: "Bangles", color: "Orange",
    colors: arr(["Orange", "Gold"]), occasion: arr(["Festive", "Wedding", "Casual"]),
    styleTags: arr(["Ethnic", "Festive", "Traditional"]), material: "Silk",
    gender: "WOMEN", season: arr(["All Season"]), price: 1600,
  },
  // ── FOOTWEAR ──
  {
    title: "Embroidered Block Heels in Gold Silk",
    description: "Block heeled sandals with hand-embroidered silk upper. Festive footwear par excellence.",
    category: "Footwear", subcategory: "Heels", color: "Gold",
    colors: arr(["Gold"]), occasion: arr(["Wedding", "Festive", "Party"]),
    styleTags: arr(["Bridal", "Traditional", "Festive"]), material: "Silk",
    gender: "WOMEN", season: arr(["All Season"]), price: 5600,
  },
  {
    title: "Kolhapuri Chappal in Brown Leather",
    description: "Authentic Kolhapuri sandals in genuine leather. Perfect with casual ethnic wear.",
    category: "Footwear", subcategory: "Flats", color: "Brown",
    colors: arr(["Brown"]), occasion: arr(["Casual", "Traditional"]),
    styleTags: arr(["Ethnic", "Boho", "Casual"]), material: "Leather",
    gender: "WOMEN", season: arr(["All Season"]), price: 1800,
  },
  {
    title: "Juttis in Embroidered Maroon Velvet",
    description: "Hand-embroidered Punjabi juttis in rich maroon velvet with gold thread.",
    category: "Footwear", subcategory: "Juttis", color: "Maroon",
    colors: arr(["Maroon", "Gold"]), occasion: arr(["Wedding", "Festive", "Traditional"]),
    styleTags: arr(["Traditional", "Ethnic", "Festive"]), material: "Velvet",
    gender: "WOMEN", season: arr(["All Season"]), price: 2800,
  },
  {
    title: "Stiletto Heels in Metallic Silver",
    description: "Contemporary stilettos in metallic silver. Bridges ethnic and western styling.",
    category: "Footwear", subcategory: "Heels", color: "Silver",
    colors: arr(["Silver"]), occasion: arr(["Party", "Wedding", "Anniversary"]),
    styleTags: arr(["Contemporary", "Fusion", "Festive"]), material: "Leather",
    gender: "WOMEN", season: arr(["All Season"]), price: 4200,
  },
  {
    title: "Embellished Wedge Sandals in Champagne",
    description: "Wedge sandals with crystal embellishments. Comfortable yet glamorous.",
    category: "Footwear", subcategory: "Wedge Heels", color: "Gold",
    colors: arr(["Gold", "Beige"]), occasion: arr(["Wedding", "Party", "Festive"]),
    styleTags: arr(["Contemporary", "Festive", "Bridal"]), material: "Leather",
    gender: "WOMEN", season: arr(["Summer", "All Season"]), price: 4800,
  },
  // ── CLUTCHES & HANDBAGS ──
  {
    title: "Embroidered Potli Bag in Red Velvet",
    description: "Traditional drawstring potli with zardozi embroidery. Perfect bridal accessory.",
    category: "Clutch", subcategory: "Potli Bag", color: "Red",
    colors: arr(["Red", "Gold"]), occasion: arr(["Wedding", "Bridal", "Festive"]),
    styleTags: arr(["Traditional", "Bridal", "Festive"]), material: "Velvet",
    gender: "WOMEN", season: arr(["All Season"]), price: 2400,
  },
  {
    title: "Box Clutch in Gold Metallic with Minaudière Frame",
    description: "Structured box clutch in gold metallic. Glamorous statement accessory.",
    category: "Clutch", subcategory: "Box Clutch", color: "Gold",
    colors: arr(["Gold"]), occasion: arr(["Party", "Wedding", "Anniversary"]),
    styleTags: arr(["Contemporary", "Festive", "Royal"]), material: "Metal",
    gender: "WOMEN", season: arr(["All Season"]), price: 5800,
  },
  {
    title: "Beaded Clutch in Emerald Green",
    description: "Handbeaded clutch with peacock motif. A statement piece for festive occasions.",
    category: "Clutch", subcategory: "Beaded Clutch", color: "Green",
    colors: arr(["Green", "Gold"]), occasion: arr(["Wedding", "Festive", "Party"]),
    styleTags: arr(["Ethnic", "Festive", "Traditional"]), material: "Cotton",
    gender: "WOMEN", season: arr(["All Season"]), price: 3200,
  },
  {
    title: "Brocade Silk Clutch in Ivory & Silver",
    description: "Elegant brocade clutch with silver clasp. Ideal for bridal and wedding functions.",
    category: "Clutch", subcategory: "Silk Clutch", color: "White",
    colors: arr(["White", "Silver"]), occasion: arr(["Bridal", "Wedding", "Party"]),
    styleTags: arr(["Bridal", "Minimalist", "Contemporary"]), material: "Silk",
    gender: "WOMEN", season: arr(["All Season"]), price: 4200,
  },
  {
    title: "Jute Tote Bag with Block Print in Navy Blue",
    description: "Eco-friendly jute tote with hand block print. Casual ethnic accessory.",
    category: "Handbag", subcategory: "Tote Bag", color: "Blue",
    colors: arr(["Blue", "White"]), occasion: arr(["Casual", "Office"]),
    styleTags: arr(["Casual", "Boho", "Ethnic"]), material: "Cotton",
    gender: "WOMEN", season: arr(["All Season"]), price: 1200,
  },
  {
    title: "Phulkari Embroidered Sling Bag in Orange",
    description: "Vibrant Punjabi phulkari embroidery on canvas sling. Boho meets ethnic.",
    category: "Handbag", subcategory: "Sling Bag", color: "Orange",
    colors: arr(["Orange", "Multicolor"]), occasion: arr(["Casual", "Festive"]),
    styleTags: arr(["Boho", "Ethnic", "Casual"]), material: "Cotton",
    gender: "WOMEN", season: arr(["Summer", "Spring"]), price: 1800,
  },
  // ── MEN'S ──
  {
    title: "Sherwani in Ivory Silk with Gold Embroidery",
    description: "Bridal sherwani in ivory silk with intricate gold zari work.",
    category: "Suit", subcategory: "Sherwani", color: "White",
    colors: arr(["White", "Gold"]), occasion: arr(["Bridal", "Wedding", "Festive"]),
    styleTags: arr(["Bridal", "Traditional", "Royal"]), material: "Silk",
    gender: "MEN", season: arr(["All Season"]), price: 58000,
  },
  {
    title: "Kurta Pajama Set in Navy Blue with White Embroidery",
    description: "Classic kurta pajama set in linen-silk blend. Effortlessly elegant.",
    category: "Kurta", subcategory: "Kurta Set", color: "Blue",
    colors: arr(["Blue", "White"]), occasion: arr(["Wedding", "Festive", "Casual"]),
    styleTags: arr(["Traditional", "Ethnic", "Minimalist"]), material: "Linen",
    gender: "MEN", season: arr(["All Season"]), price: 6500,
  },
  {
    title: "Raw Silk Nehru Jacket in Bottle Green",
    description: "Smart Nehru jacket in raw silk. Pairs with both ethnic and western outfits.",
    category: "Suit", subcategory: "Nehru Jacket", color: "Green",
    colors: arr(["Green"]), occasion: arr(["Festive", "Party", "Wedding"]),
    styleTags: arr(["Fusion", "Contemporary", "Ethnic"]), material: "Silk",
    gender: "MEN", season: arr(["Winter", "Autumn"]), price: 8200,
  },
  {
    title: "Mens Silk Stole in Saffron Orange",
    description: "Silk dupatta for men. Traditionally draped over kurta for festive occasions.",
    category: "Dupatta", subcategory: "Mens Stole", color: "Orange",
    colors: arr(["Orange", "Gold"]), occasion: arr(["Wedding", "Festive", "Traditional"]),
    styleTags: arr(["Traditional", "Ethnic", "Festive"]), material: "Silk",
    gender: "MEN", season: arr(["All Season"]), price: 2400,
  },
  {
    title: "Kolhapuri Chappals in Tan Leather (Men)",
    description: "Handcrafted Kolhapuri chappals for men. Timeless ethnic footwear.",
    category: "Footwear", subcategory: "Ethnic Footwear", color: "Brown",
    colors: arr(["Brown", "Beige"]), occasion: arr(["Casual", "Festive", "Traditional"]),
    styleTags: arr(["Ethnic", "Traditional", "Casual"]), material: "Leather",
    gender: "MEN", season: arr(["All Season"]), price: 2200,
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  let demoUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (!demoUser) {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);
    demoUser = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        name: "Demo Retailer",
        password: hashedPassword,
        storeName: "Elegance Boutique",
      },
    });
    console.log("✅ Demo user created:", DEMO_EMAIL);
  } else {
    console.log("ℹ️  Demo user already exists:", DEMO_EMAIL);
  }

  const existingCount = await prisma.product.count({
    where: { userId: demoUser.id },
  });

  if (existingCount >= products.length) {
    console.log(`ℹ️  ${existingCount} products already exist. Skipping seed.`);
    return;
  }

  let created = 0;
  for (const [i, product] of products.entries()) {
    const sku = `${product.category.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(4, "0")}`;
    await prisma.product.upsert({
      where: { sku },
      create: { ...product, sku, userId: demoUser.id },
      update: {},
    });
    created++;
  }

  console.log(`✅ ${created} products seeded`);
  console.log("\n🎉 Seed complete!");
  console.log(`   Login:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
