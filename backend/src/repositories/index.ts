/**
 * Repository barrel export.
 * Import all repositories from this single entry point.
 */

export { UserRepository, userRepository } from "./user.repository";
export {
  SenderAccountRepository,
  senderAccountRepository,
} from "./sender-account.repository";
export {
  CampaignRepository,
  campaignRepository,
} from "./campaign.repository";
export {
  EmailMessageRepository,
  emailMessageRepository,
} from "./email-message.repository";
export {
  SlackConnectionRepository,
  slackConnectionRepository,
} from "./slack-connection.repository";
