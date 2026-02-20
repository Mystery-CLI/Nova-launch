import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from './Modal';
import { Button } from './Button';
import { useConfetti } from '../../hooks/useConfetti';
import type { DeploymentResult } from '../../types';
import { truncateAddress, formatDate } from '../../utils/formatting';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokenName: string;
    tokenSymbol: string;
    tokenAddress: string;
    /** Optional full deployment result for richer display */
    deploymentResult?: DeploymentResult;
}

// ─── Animation variants ───────────────────────────────────────────────────────


const containerVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 24 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 300,
            damping: 28,
            staggerChildren: 0.08,
            delayChildren: 0.15,
        },
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: 16,
        transition: { duration: 0.2 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const checkmarkVariants = {
    hidden: { scale: 0, rotate: -45 },
    visible: {
        scale: 1,
        rotate: 0,
        transition: { type: 'spring', stiffness: 350, damping: 20, delay: 0.1 },
    },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated SVG checkmark drawn via stroke-dashoffset */
function AnimatedCheckmark() {
    return (
        <motion.div
            className="relative flex items-center justify-center"
            variants={checkmarkVariants}
        >
            {/* Outer ring pulse */}
            <motion.div
                className="absolute w-28 h-28 rounded-full bg-green-400"
                initial={{ scale: 0.8, opacity: 0.4 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
            />
            {/* Circle background */}
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center shadow-lg">
                <svg
                    className="w-14 h-14 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                >
                    <motion.path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.55, ease: 'easeOut', delay: 0.35 }}
                    />
                </svg>
            </div>
        </motion.div>
    );
}

/** Copy-to-clipboard button with animated feedback */
function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers / non-secure contexts
            const el = document.createElement('textarea');
            el.value = text;
            el.style.position = 'fixed';
            el.style.opacity = '0';
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all
                       text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500"
            title={`Copy ${label}`}
            aria-label={copied ? 'Copied!' : `Copy ${label}`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                    <motion.span
                        key="check"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1 text-green-600"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                    </motion.span>
                ) : (
                    <motion.span
                        key="copy"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SuccessModal({
    isOpen,
    onClose,
    tokenName,
    tokenSymbol,
    tokenAddress,
    deploymentResult,
}: SuccessModalProps) {
    const { fire: fireConfetti, stop: stopConfetti } = useConfetti();

    // Fire confetti when modal opens; stop when it closes
    useEffect(() => {
        if (isOpen) {
            // Small delay so the modal entrance animation plays first
            const t = setTimeout(fireConfetti, 350);
            return () => {
                clearTimeout(t);
                stopConfetti();
            };
        }
    }, [isOpen, fireConfetti, stopConfetti]);

    const shareSuccess = useCallback(() => {
        const shareText = `🎉 I just deployed ${tokenName} (${tokenSymbol}) on Nova Launch!\nToken address: ${tokenAddress}`;
        const shareUrl = window.location.href;

        if (navigator.share) {
            navigator
                .share({ title: `${tokenName} deployed on Nova Launch!`, text: shareText, url: shareUrl })
                .catch(() => {
                    // User cancelled — not an error
                });
        } else {
            // Graceful fallback: copy share text
            navigator.clipboard
                .writeText(`${shareText}\n${shareUrl}`)
                .then(() => alert('Share text copied to clipboard!'))
                .catch(() => alert(`Share: ${shareText}`));
        }
    }, [tokenName, tokenSymbol, tokenAddress]);

    const explorerUrl = deploymentResult
        ? `https://stellar.expert/explorer/testnet/contract/${tokenAddress}`
        : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="" hideHeader size="md">
            {/* We manage our own animated content inside the Modal's content slot */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="success-content"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="py-4 text-center"
                        role="status"
                        aria-live="polite"
                        aria-label={`Token ${tokenName} deployed successfully`}
                    >
                        {/* ── Close button (top-right) ── */}
                        <motion.button
                            variants={itemVariants}
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label="Close"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </motion.button>

                        {/* ── Animated checkmark ── */}
                        <motion.div variants={itemVariants} className="mb-6 flex justify-center">
                            <AnimatedCheckmark />
                        </motion.div>

                        {/* ── Title ── */}
                        <motion.h2
                            variants={itemVariants}
                            className="text-2xl font-bold text-gray-900 mb-2"
                        >
                            🎉 Token Deployed Successfully!
                        </motion.h2>

                        {/* ── Subtitle ── */}
                        <motion.p variants={itemVariants} className="text-gray-500 mb-6">
                            Your token{' '}
                            <span className="font-semibold text-gray-800">{tokenName}</span>{' '}
                            <span className="text-gray-400">({tokenSymbol})</span> is live on the Stellar network.
                        </motion.p>

                        {/* ── Token address card ── */}
                        <motion.div
                            variants={itemVariants}
                            className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 text-left"
                        >
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                Token Address
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="text-sm text-gray-800 font-mono break-all flex-1 select-all">
                                    {tokenAddress}
                                </code>
                                <CopyButton text={tokenAddress} label="token address" />
                            </div>
                        </motion.div>

                        {/* ── Deployment details (if available) ── */}
                        {deploymentResult && (
                            <motion.div
                                variants={itemVariants}
                                className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left space-y-3"
                            >
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Deployment Details
                                </p>

                                {/* Transaction hash */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-500 shrink-0">Tx Hash</span>
                                    <div className="flex items-center gap-1 min-w-0">
                                        <code className="text-xs text-gray-700 font-mono truncate">
                                            {truncateAddress(deploymentResult.transactionHash, 10, 8)}
                                        </code>
                                        <CopyButton text={deploymentResult.transactionHash} label="transaction hash" />
                                    </div>
                                </div>

                                {/* Fee */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Total Fee</span>
                                    <span className="text-xs font-medium text-gray-800">
                                        {deploymentResult.totalFee} XLM
                                    </span>
                                </div>

                                {/* Timestamp */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Deployed At</span>
                                    <span className="text-xs font-medium text-gray-800">
                                        {formatDate(deploymentResult.timestamp)}
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Action buttons ── */}
                        <motion.div
                            variants={itemVariants}
                            className="flex flex-col sm:flex-row gap-3 justify-center"
                        >
                            {/* Share */}
                            <Button
                                variant="primary"
                                onClick={shareSuccess}
                                className="flex items-center justify-center gap-2"
                                aria-label="Share your token deployment"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                Share Success
                            </Button>

                            {/* View on explorer */}
                            {explorerUrl && (
                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-base font-medium rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-gray-500"
                                    aria-label="View token on Stellar Expert explorer"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View on Explorer
                                </a>
                            )}

                            {/* Close */}
                            <Button
                                variant="outline"
                                onClick={onClose}
                                aria-label="Close success dialog"
                            >
                                Done
                            </Button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Modal>
    );
}
