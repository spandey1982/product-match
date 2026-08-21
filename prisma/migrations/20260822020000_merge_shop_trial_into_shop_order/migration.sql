-- Merge ShopTrialRequest into ShopOrder: the home-trial flow is no longer a
-- separate system, it's one more orderType on shop_orders.

-- AlterTable
ALTER TABLE "shop_orders"
  ADD COLUMN "size" TEXT,
  ADD COLUMN "trialDate" TEXT,
  ADD COLUMN "trialSlot" TEXT;

-- Carry over any existing trial requests as orderType 'trial' rows, remapping
-- the old one-off "sold" status to "order_completed" (its replacement).
INSERT INTO "shop_orders" (
  "id", "customerId", "orderType",
  "productId", "productTitle", "productImage", "storeName", "size",
  "quantity", "unitPrice", "amountTotal",
  "customerName", "customerPhone", "customerEmail",
  "addressLine1", "addressPincode", "addressLandmark",
  "trialDate", "trialSlot", "specialInstructions",
  "paymentMethod", "status", "paymentStatus",
  "createdAt", "updatedAt"
)
SELECT
  "id", "customerId", 'trial',
  "productId", "productTitle", "productImage", "storeName", "size",
  1, "price", "price",
  "customerName", "customerPhone", "customerEmail",
  "addressLine1", "addressPincode", "addressLandmark",
  "trialDate", "trialSlot", "specialInstructions",
  "paymentMethod",
  CASE WHEN "status" = 'sold' THEN 'order_completed' ELSE "status" END,
  "paymentStatus",
  "createdAt", "updatedAt"
FROM "shop_trial_requests";

-- DropForeignKey
ALTER TABLE "shop_trial_requests" DROP CONSTRAINT "shop_trial_requests_customerId_fkey";

-- DropTable
DROP TABLE "shop_trial_requests";
