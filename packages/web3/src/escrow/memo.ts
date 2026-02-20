import { TransactionInstruction, PublicKey } from '@solana/web3.js'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export function createMemoInstruction(text: string): TransactionInstruction {
  if (!text || typeof text !== 'string') throw new Error('Memo text must be a non-empty string')
  const data = Buffer.from(text, 'utf8')
  return new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data,
  })
}
