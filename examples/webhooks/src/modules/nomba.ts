import { 
    NOMBA_ACCOUNT_ID, 
    NOMBA_CLIENT_ID, 
    NOMBA_CLIENT_SECRET,
    NOMBA_ENVIRONMENT
} from "../config/env.config.ts";
import { Nomba } from "@nomba/node-sdk";

const nomba = new Nomba({
    accountId: NOMBA_ACCOUNT_ID,
    clientId: NOMBA_CLIENT_ID,
    clientSecret: NOMBA_CLIENT_SECRET,
    environment: NOMBA_ENVIRONMENT,
});

export default nomba;