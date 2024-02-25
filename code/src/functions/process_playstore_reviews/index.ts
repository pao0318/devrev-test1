import {publicSDK } from '@devrev/typescript-sdk';
import * as gplay from "google-play-scraper";
import { ApiUtils, HTTPResponse } from './utils';
import {LLMUtils} from './llm_utils';

export const run = async (events: any[]) => {
  for (const event of events) {
    const endpoint: string = event.execution_metadata.devrev_endpoint;
    const token: string = event.context.secrets.service_account_token;
    const fireWorksApiKey: string = event.input_data.keyrings.fireworks_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    // Get the number of reviews to fetch from command args.
    const snapInId = event.context.snap_in_id;
    const devrevPAT = event.context.secrets.service_account_token;
    const baseURL = event.execution_metadata.devrev_endpoint;
    const inputs = event.input_data.global_values;
    let parameters:string = event.payload.parameters.trim();
    const tags = event.input_data.resources.tags;
    const llmUtil: LLMUtils = new LLMUtils(fireWorksApiKey, `accounts/fireworks/models/${inputs['llm_model_to_use']}`, 200);
    let numReviews = 10;
    let commentID : string | undefined;

    var params: string[] = [];
    if (typeof parameters === 'string' && parameters !== 'help') {
      params = parameters.split(' ');
      let postResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Parameters provided ${params}`, 1); 
    }

      const systemPrompt = `You are an expert at analyzing a given phrase of three/four words and generating a short trendy caption/tweet using individual words of that phrase. You are given a phrase of about three/four words provided by a user for the app ${inputs['app_id']}. The input given to you is ${params}. You have to generate a JSON output with fields "text" of type string and "hashtags" of type array of strings. The "text" field should be a small catchy tweet or caption related to ${params} provided by user as input. The "hashtags" field should be three to four proper hashtags in an array that fits the text field that is generated`;
      const humanPrompt = ``;

      let llmResponse: Object = {};
      try {
        llmResponse = await llmUtil.chatCompletion(systemPrompt, humanPrompt, {params});
        console.log((llmResponse as any).text, 'llm response');
        let postResp = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Creating ticket for review: ${(llmResponse as any).text}`, 1);
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }

      const createTicketResp = await apiUtil.createTicket({
        title: 'generate tweet',
        tags: [{id: tags['generate_tweet'].id}],
        body: `${(llmResponse as any).text}`,
        type: publicSDK.WorkType.Ticket,
        owned_by: [inputs['default_owner_id']],
        applies_to_part: inputs['default_part_id'],
      });
      if (!createTicketResp.success) {
        console.error(`Error while creating ticket: ${createTicketResp.message}`);
        continue;
      }

      // Post a message with ticket ID.
      else{
      const ticketID = createTicketResp.data.work.id;
      const ticketCreatedMessage = `Created ticket successfully with id : <${ticketID}>`;
      const postTicketResp: HTTPResponse  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, ticketCreatedMessage, 1);
      if (!postTicketResp.success) {
        console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
        continue;
      }
    }
    // Call an LLM to categorize the review as Bug, Feature request, or Question.
  }
}

export default run;
