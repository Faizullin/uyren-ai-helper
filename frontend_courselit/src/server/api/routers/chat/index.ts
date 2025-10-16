import { router } from "@/server/api/core/trpc";
import { chatRoomRouter } from "./chat-room";
import { chatMessageRouter } from "./chat-message";
import { chatParticipantRouter } from "./chat-participant";

export const chatModuleRouter = router({
  room: chatRoomRouter,
  message: chatMessageRouter,
  participant: chatParticipantRouter,
});

