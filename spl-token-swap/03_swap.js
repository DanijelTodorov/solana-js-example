/**
 * https://github.com/solana-labs/solana-program-library/blob/master/token-swap/js/test/main.test.ts 
 */

/**
 * 성공한 스왑 : https://explorer.solana.com/tx/4meKHKjmvANY4FZcfFyB5QXWoVdQyvACzAkK2sZBvbCZByfF2SDQ8Gd699ee4fhEBnnhgaocH43d5d2TeeGF1CoF?cluster=devnet 
 */

import "dotenv/config"
import { getKeypairFromEnvironment } from "@solana-developers/helpers";
import { TokenSwap, CurveType, TOKEN_SWAP_PROGRAM_ID } from '@solana/spl-token-swap';
import {
      Keypair,
      Connection,
      clusterApiUrl,
      PublicKey,
      SystemProgram,
      Transaction,
      sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
      approve,
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
import { assert, sleep } from "./99_utils.js";
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
      POOL_TOKEN_AMOUNT
} from './99_utils.js'

swap()

export async function swap() {
      const connection = new Connection(clusterApiUrl("devnet"));
      const payer = getKeypairFromEnvironment("SECRET_KEY");
      const owner = getKeypairFromEnvironment("OWNER_SECRET_KEY");
      const tokenSwapAccount = getKeypairFromEnvironment("TOKEN_SWAP_ACCOUNT_SECRET_KEY");
      const swapPayer = getKeypairFromEnvironment("SWAP_PAYER_SECRET_KEY");

      const mintA = (await getMint(
            connection,
            new PublicKey(process.env.TOKEN_A_ADDRESS)
      )).address

      const mintB = (await getMint(
            connection,
            new PublicKey(process.env.TOKEN_B_ADDRESS)
      )).address

      const tokenPool = (await getMint(
            connection,
            new PublicKey(process.env.TOKEN_POOL_MINT_ADDRESS)
      )).address


      const tokenAccountA = (await getAccount(
            connection,
            new PublicKey(process.env.TOKEN_A_ACCOUNT),
            undefined,
            TOKEN_PROGRAM_ID
      )).address

      const tokenAccountB = (await getAccount(
            connection,
            new PublicKey(process.env.TOKEN_B_ACCOUNT),
            undefined,
            TOKEN_PROGRAM_ID
      )).address

      const tokenSwap = await TokenSwap.loadTokenSwap(
            connection,
            tokenSwapAccount.publicKey,
            TOKEN_SWAP_PROGRAM_ID,
            swapPayer,
      );

      console.log("tokenSwap : ", tokenSwap)

      console.log('Creating swap token a account');
      const userAccountA = await createAccount(
            connection,
            payer,
            mintA,
            owner.publicKey,
            Keypair.generate(),
      );

      console.log("mint to userAccountA"); sleep(100);
      await mintTo(connection, payer, mintA, userAccountA, owner, SWAP_AMOUNT_IN * 10n);
      
      const userTransferAuthority = Keypair.generate(); sleep(100);
      await approve(
            connection,
            payer,
            userAccountA,
            userTransferAuthority.publicKey,
            owner,
            SWAP_AMOUNT_IN,
      );

      console.log("userTransferAuthority : ", userTransferAuthority.publicKey.toBase58())
      console.log("userAccountA : ", userAccountA)

      console.log('Creating swap token b account');
      const userAccountB = await createAccount(
            connection,
            payer,
            mintB,
            owner.publicKey,
            Keypair.generate(),
      );
      const poolAccount = await createAccount(
            connection,
            payer,
            tokenPool,
            owner.publicKey,
            Keypair.generate(),
      )


      console.log("userAccountB : ", userAccountB)


      const confirmOptions = {
            skipPreflight: true,
      };

      sleep(1000)
      console.log('Swapping');
      await tokenSwap.swap(
            userAccountA,
            tokenAccountA,
            tokenAccountB,
            userAccountB,
            // tokenSwap.mintA,
            // tokenSwap.mintB,
            TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            null,
            userTransferAuthority,
            SWAP_AMOUNT_IN,
            0n,
            confirmOptions,
      );

      await sleep(500);

      let info;
      info = await getAccount(connection, userAccountA);
      console.log("userAccountA : ",info)
      // assert(info.amount == 0n);

      info = await getAccount(connection, userAccountB);
      console.log("userAccountB : ", info)
      assert(info.amount == SWAP_AMOUNT_OUT);

      info = await getAccount(connection, tokenAccountA);
      assert(info.amount == currentSwapTokenA + SWAP_AMOUNT_IN);
      currentSwapTokenA += SWAP_AMOUNT_IN;

      info = await getAccount(connection, tokenAccountB);
      assert(info.amount == currentSwapTokenB - SWAP_AMOUNT_OUT);
      currentSwapTokenB -= SWAP_AMOUNT_OUT;

      info = await getAccount(connection, tokenAccountPool);
      assert(info.amount == DEFAULT_POOL_TOKEN_AMOUNT - POOL_TOKEN_AMOUNT);

      info = await getAccount(connection, feeAccount);
      assert(info.amount == currentFeeAmount + OWNER_SWAP_FEE);

      if (poolAccount != null) {
            info = await getAccount(connection, poolAccount);
            assert(info.amount == HOST_SWAP_FEE);
      }
}