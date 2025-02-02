/**
 * https://github.com/solana-labs/solana-program-library/blob/master/token-swap/js/test/main.test.ts 
 */

import "dotenv/config"
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import { TokenSwap, CurveType, OLD_TOKEN_SWAP_PROGRAM_ID, TOKEN_SWAP_PROGRAM_ID } from '@solana/spl-token-swap';
import {
      Keypair,
      Connection,
      clusterApiUrl,
      PublicKey,
} from '@solana/web3.js';
import {
      createMint,
      createAccount,
      createApproveInstruction,
      createInitializeAccountInstruction,
      getMint,
      getAccount,
      getMinimumBalanceForRentExemptAccount,
      getOrCreateAssociatedTokenAccount,
      mintTo,
      AccountLayout,
      TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import {
      SWAP_PROGRAM_OWNER_FEE_ADDRESS,
      TRADING_FEE_NUMERATOR,
      TRADING_FEE_DENOMINATOR,
      OWNER_TRADING_FEE_NUMERATOR,
      OWNER_TRADING_FEE_DENOMINATOR,
      OWNER_WITHDRAW_FEE_NUMERATOR,
      OWNER_WITHDRAW_FEE_DENOMINATOR,
      HOST_FEE_NUMERATOR,
      HOST_FEE_DENOMINATOR,
      currentSwapTokenA,
      currentSwapTokenB,
      currentFeeAmount,
      SWAP_AMOUNT_IN,
      SWAP_AMOUNT_OUT,
      SWAP_FEE,
      HOST_SWAP_FEE,
      OWNER_SWAP_FEE,
      DEFAULT_POOL_TOKEN_AMOUNT,
      POOL_TOKEN_AMOUNT,
      assert, sleep
} from './99_utils.js'
import bs58 from 'bs58';

const main = async () => {
      console.log('Run test: createTokenSwap (constant price)');
      const constantPrice = new Uint8Array(8);
      constantPrice[0] = 1;
      await createTokenSwap(CurveType.ConstantProduct, undefined, true, true);
}

async function createTokenSwap(
      curveType,
      curveParameters = undefined,
      skipCreate = true,
      skipMint = true
) {
      const connection = new Connection(clusterApiUrl("devnet"));
      let payer = getKeypairFromEnvironment("SECRET_KEY");
      let owner = getKeypairFromEnvironment("OWNER_SECRET_KEY");
      let tokenSwapAccount
      if (skipCreate) {
            tokenSwapAccount = getKeypairFromEnvironment("TOKEN_SWAP_ACCOUNT_SECRET_KEY");
      }
      else {
            tokenSwapAccount = Keypair.generate();
      }

      let [authority, bumpSeed] = await PublicKey.findProgramAddress(
            [tokenSwapAccount.publicKey.toBuffer()],
            TOKEN_SWAP_PROGRAM_ID,
      ); sleep(100);

      console.log("tokenSwapAccount  : ", tokenSwapAccount.publicKey.toBase58())
      console.log("authority : ", authority)

      let tokenPool
      let tokenAccountPool;
      let feeAccount;
      if (skipCreate) {
            console.log("getting pool infos")
            tokenPool = new PublicKey(process.env.TOKEN_POOL_MINT_ADDRESS)
            // tokenPool = (await getMint(
            //       connection,
            //       new PublicKey(process.env.TOKEN_POOL_MINT_ADDRESS)
            // )).address
            tokenAccountPool = new PublicKey(process.env.TOKEN_POOL_ACCOUNT)
            feeAccount = new PublicKey(process.env.FEE_ACCOUNT)
      }
      else {
            console.log('creating pool mint');
            tokenPool = await createMint(
                  connection,
                  payer,
                  authority,
                  null,
                  2,
                  Keypair.generate(),
                  undefined,
                  TOKEN_PROGRAM_ID,
            );
            console.log('creating pool account');
            tokenAccountPool = await createAccount(
                  connection,
                  payer,
                  tokenPool,
                  owner.publicKey,
                  Keypair.generate(),
            );
            console.log('creating fee account');
            const ownerKey = owner.publicKey.toString();
            feeAccount = await createAccount(
                  connection,
                  payer,
                  tokenPool,
                  new PublicKey(ownerKey),
                  Keypair.generate(),
            );
      }

      console.log("tokenPool : ", tokenPool, '\n')
      console.log("tokenAccountPool : ", tokenAccountPool)
      console.log("feeAccount : ", feeAccount)

      let mintA;
      let tokenAccountA;
      const mintAProgramId = TOKEN_PROGRAM_ID;
      if (skipCreate) {
            console.log('getting token A account');

            mintA = (await getMint(
                  connection,
                  new PublicKey(process.env.TOKEN_A_ADDRESS)
            )).address
            tokenAccountA = (await getAccount(
                  connection,
                  new PublicKey(process.env.TOKEN_A_ACCOUNT),
                  undefined,
                  TOKEN_PROGRAM_ID
            )).address
      }
      else {
            console.log('creating token A');
            mintA = await createMint(
                  connection,
                  payer,
                  owner.publicKey,
                  null,
                  2,
                  Keypair.generate(),
                  undefined,
                  mintAProgramId,
            );
            console.log('creating token A account');
            tokenAccountA = await createAccount(
                  connection,
                  payer,
                  mintA,
                  authority,
                  Keypair.generate(),
            );
      }

      if (!skipMint) {
            sleep(500)
            console.log('minting token A to swap');
            await mintTo(
                  connection,
                  payer,
                  mintA,
                  tokenAccountA,
                  owner,
                  currentSwapTokenA,
            );
      }

      console.log(`mintA : `, mintA)
      console.log("tokenAccountA : ", tokenAccountA)


      let mintB;
      let tokenAccountB;
      const mintBProgramId = TOKEN_PROGRAM_ID;
      if (skipCreate) {
            console.log('getting token B infos'); 

            mintB = (await getMint(
                  connection,
                  new PublicKey(process.env.TOKEN_B_ADDRESS)
            )).address
            tokenAccountB = (await getAccount(
                  connection,
                  new PublicKey(process.env.TOKEN_B_ACCOUNT),
                  undefined,
                  TOKEN_PROGRAM_ID
            )).address
      }
      else {
            console.log('creating token B'); sleep(500)
            mintB = await createMint(
                  connection,
                  payer,
                  owner.publicKey,
                  null,
                  2,
                  Keypair.generate(),
                  undefined,
                  mintBProgramId,
            );

            console.log('creating token B account');
            tokenAccountB = await createAccount(
                  connection,
                  payer,
                  mintB,
                  authority,
                  Keypair.generate(),
            );
      }

      console.log("mintB : ", mintB)
      console.log("tokenAccountB : ", tokenAccountB)

      if (!skipMint) {
            sleep(500)
            console.log('minting token B to swap');
            await mintTo(
                  connection,
                  payer,
                  mintB,
                  tokenAccountB,
                  owner,
                  currentSwapTokenB,
            );
      }


      console.log('creating token swap');
      const swapPayer = getKeypairFromEnvironment("SWAP_PAYER_SECRET_KEY");
      console.log("swapPayer : ", swapPayer.publicKey)
      let tokenSwap;
      if (!skipCreate) {
            tokenSwap = await TokenSwap.createTokenSwap(
                  connection,
                  swapPayer,
                  tokenSwapAccount,
                  authority,
                  tokenAccountA,
                  tokenAccountB,
                  tokenPool,
                  mintA,
                  mintB,
                  feeAccount,
                  tokenAccountPool,
                  TOKEN_SWAP_PROGRAM_ID,
                  TOKEN_PROGRAM_ID,
                  0n,
                  0n,
                  0n,
                  0n,
                  0n,
                  0n,
                  0n,
                  0n,
                  curveType,
                  curveParameters,
            );
      }

      console.log('loading token swap');
      const fetchedTokenSwap = await TokenSwap.loadTokenSwap(
            connection,
            tokenSwapAccount.publicKey,
            TOKEN_SWAP_PROGRAM_ID,
            swapPayer,
      );
      console.log(fetchedTokenSwap)

      assert(fetchedTokenSwap.poolTokenProgramId.equals(TOKEN_PROGRAM_ID));
      assert(fetchedTokenSwap.tokenAccountA.equals(tokenAccountA));
      assert(fetchedTokenSwap.tokenAccountB.equals(tokenAccountB));
      assert(fetchedTokenSwap.mintA.equals(mintA));
      assert(fetchedTokenSwap.mintB.equals(mintB));
      assert(fetchedTokenSwap.poolToken.equals(tokenPool));
      assert(fetchedTokenSwap.feeAccount.equals(feeAccount));
      assert(TRADING_FEE_NUMERATOR == fetchedTokenSwap.tradeFeeNumerator);
      assert(TRADING_FEE_DENOMINATOR == fetchedTokenSwap.tradeFeeDenominator);
      assert(
            OWNER_TRADING_FEE_NUMERATOR == fetchedTokenSwap.ownerTradeFeeNumerator,
      );
      assert(
            OWNER_TRADING_FEE_DENOMINATOR == fetchedTokenSwap.ownerTradeFeeDenominator,
      );
      assert(
            OWNER_WITHDRAW_FEE_NUMERATOR == fetchedTokenSwap.ownerWithdrawFeeNumerator,
      );
      assert(
            OWNER_WITHDRAW_FEE_DENOMINATOR ==
            fetchedTokenSwap.ownerWithdrawFeeDenominator,
      );
      assert(HOST_FEE_NUMERATOR == fetchedTokenSwap.hostFeeNumerator);
      assert(HOST_FEE_DENOMINATOR == fetchedTokenSwap.hostFeeDenominator);
      assert(curveType == fetchedTokenSwap.curveType);
}

main()