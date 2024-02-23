import {publicSDK } from '@devrev/typescript-sdk';
import { ApiUtils, HTTPResponse } from './utils';
import {LLMUtils} from './llm_utils';
import axios from 'axios';

export const run = async (events: any[]) => {
  for (const event of events) {
    const endpoint: string = event.execution_metadata.devrev_endpoint;
    const token: string = event.context.secrets.service_account_token;
    const fireWorksApiKey: string = event.input_data.keyrings.fireworks_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    const snapInId = event.context.snap_in_id;
    const inputs = event.input_data.global_values;

    const tags = event.input_data.resources.tags;
    const llmUtil: LLMUtils = new LLMUtils(fireWorksApiKey, `accounts/fireworks/models/${inputs['llm_model_to_use']}`, 200);

    const apiUrl =  'https://twitter154.p.rapidapi.com/user/tweets?username=omarmhaimdat&limit=1&user_id=96479162&include_replies=false&include_pinned=false';
    const headers = {
      'X-RapidAPI-Key': '16bab69374mshcb1b27ff71d944ep1507ccjsn7d4e5c5edec4',
      'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
    };

    const response = await axios.get(apiUrl, { headers });
    const tweetText = response.data.results[0].text;

     // Process the fetched data
      let postResp = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Fetched tweet text: ${tweetText}`, 1);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }

      const reviewText = `Ticket created from Playstore review ${apiUrl}\n\n${tweetText}`;
      const systemPrompt = `You are an expert at labelling a given Google Play Store Review as bug, feature_request, question or feedback. You are given a review provided by a user for the app ${inputs['app_id']}. You have to label the review as bug, feature_request, question or feedback. The output should be a JSON with fields "category" and "reason". The "category" field should be one of "bug", "feature_request", "question" or "feedback". The "reason" field should be a string explaining the reason for the category. \n\nReview: {review}\n\nOutput:`;
      const humanPrompt = ``;

      let llmResponse = {};
      try {
        llmResponse = await llmUtil.chatCompletion(systemPrompt, humanPrompt, {review: ('tweet review' ? 'tweet' + '\n' + reviewText: reviewText)})
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }
      let inferredCategory = 'failed_to_infer_category';
      if ('category' in llmResponse) {
        inferredCategory = llmResponse['category'] as string;
        if (!(inferredCategory in tags)) {
          inferredCategory = 'failed_to_infer_category';
        }
      }
      // Create a ticket with title as review title and description as review text.
      const createTicketResp = await apiUtil.createTicket({
        title: 'Tweet review',
        tags: [{id: tags[inferredCategory].id}],
        body: reviewText,
        type: publicSDK.WorkType.Ticket,
        owned_by: [inputs['default_owner_id']],
        applies_to_part: inputs['default_part_id'],
      });
      if (!createTicketResp.success) {
        console.error(`Error while creating ticket: ${createTicketResp.message}`);
        continue;
      }
      // Post a message with ticket ID.
      const ticketID = createTicketResp.data.work.id;
      const ticketCreatedMessage = inferredCategory != 'failed_to_infer_category' ? `Created ticket: <${ticketID}> and it is categorized as ${inferredCategory}` : `Created ticket: <${ticketID}> and it failed to be categorized`;
      const postTicketResp: HTTPResponse  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, ticketCreatedMessage, 1);
      if (!postTicketResp.success) {
        console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
      }
    }
  }


export default run;
