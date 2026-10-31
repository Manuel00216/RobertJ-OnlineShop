export { sendOrderMessageAction } from "./actions/message.actions";
export { ContactSellerDock } from "./components/ContactSellerDock";
export { OrderMessageThread } from "./components/OrderMessageThread";
export { MESSAGE_BODY_MAX_LENGTH } from "./constants/message.constants";
export { sendOrderMessageSchema, type SendOrderMessageInput } from "./schemas/message.schema";
export type { OrderMessage, OrderMessageView } from "./types/message.types";
