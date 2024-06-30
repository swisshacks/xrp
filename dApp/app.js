document.addEventListener('DOMContentLoaded', () => {
    initWeb3();
});

let web3;
let contractInstance;

async function initWeb3() {
    // Connect to local EVM node
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            // Request account access if needed
            await window.ethereum.enable();
        } catch (error) {
            console.error('User denied account access');
        }
    } else if (window.web3) {
        web3 = new Web3(web3.currentProvider);
    } else {
        console.error('No EVM provider detected');
        return;
    }

    // Load the contract ABI using an AJAX request
    const fetchAbi = async () => {
        const response = await fetch('./build/contracts/RentalDeposit.json');
        const data = await response.json();
        return data.abi;
    };

    const contractAbi = await fetchAbi();
    
    contractInstance = new web3.eth.Contract(contractAbi, '0x43026e05646cc0596d0d7d83b25fe0c1da378012');

    // Call the function to check the deposit status initially
    await checkDepositStatus();

    // Fetch deposit amount from the contract and update UI
    const depositAmount = await contractInstance.methods.depositAmount().call();
    const depositAmountEther = web3.utils.fromWei(depositAmount, 'ether');

    // Update Pay Deposit button text and attach onclick event
    const payDepositButton = document.getElementById('payDepositButton');
    payDepositButton.innerText = `Pay ${depositAmountEther} XRP Deposit`;
    payDepositButton.addEventListener('click', () => payDeposit(depositAmountEther));

    // Attach event listener for Sign Contract button
    const signContractButton = document.getElementById('signContractButton');
    signContractButton.addEventListener('click', signContract);
}

async function checkDepositStatus() {
    try {
        // Get contract state
        const depositAmountWei = await contractInstance.methods.depositAmount().call();
        const isDepositPaid = await contractInstance.methods.isDepositPaid().call();
        const isSignedByTenant = await contractInstance.methods.isSignedByTenant().call();
        const isRefundRecorded = await contractInstance.methods.isRefundRecorded().call();

        // Update status on the website based on contract state
        const statusElement = document.getElementById('status');
        let statusHTML = `
            <p>Deposit Amount: ${web3.utils.fromWei(depositAmountWei, 'ether')} XRP</p>
            <p>Deposit Paid: ${isDepositPaid}</p>
            <p>Signed by Tenant: ${isSignedByTenant}</p>
            <p>Refund Recorded: ${isRefundRecorded}</p>
        `;

        // If refund recorded, fetch and display deposit shares
        if (isRefundRecorded) {
            const { _tenantShare, _landlordShare } = await contractInstance.methods.getDepositShares().call();
            statusHTML += `
                <p>Tenant's Share: ${web3.utils.fromWei(_tenantShare, 'ether')} XRP</p>
                <p>Landlord's Share: ${web3.utils.fromWei(_landlordShare, 'ether')} XRP</p>
            `;
        }

        // Display contract balance
        const contractBalance = await web3.eth.getBalance(contractInstance.options.address);
        statusHTML += `<p>Contract Balance: ${web3.utils.fromWei(contractBalance, 'ether')} XRP</p>`;

        statusElement.innerHTML = statusHTML;

        // Show/hide buttons based on contract state
        const payDepositButton = document.getElementById('payDepositButton');
        const signContractButton = document.getElementById('signContractButton');

        payDepositButton.style.display = isDepositPaid ? 'none' : 'center';
        signContractButton.style.display = isRefundRecorded && !isSignedByTenant ? 'center' : 'none';

        // Update pay deposit button text if already paid
        if (isDepositPaid) {
            const depositAmountEther = web3.utils.fromWei(depositAmountWei, 'ether');
            payDepositButton.innerText = `Deposit Already Paid: ${depositAmountEther} XRP`;
        }

    } catch (error) {
        console.error('Error checking deposit status:', error);
    }
}

async function payDeposit(depositAmount) {
    try {
        // Convert depositAmount to wei
        const depositAmountWei = web3.utils.toWei(depositAmount, 'ether');

        // Check MetaMask availability and request account access
        if (typeof window.ethereum !== 'undefined') {
            await window.ethereum.enable();
            const accounts = await web3.eth.getAccounts();
            const account = accounts[0];

            // Perform deposit payment transaction
            const result = await contractInstance.methods.payDeposit().send({
                from: account,
                value: depositAmountWei
            });

            console.log('Deposit paid successfully:', result);

            // Update status after payment
            checkDepositStatus();
        } else {
            console.error('MetaMask is not installed or not connected.');
        }
    } catch (error) {
        console.error('Error paying deposit:', error);
    }
}

async function refundDeposit() {
    try {
        const tenantShareInput = document.getElementById('tenantShare');
        const landlordShareInput = document.getElementById('landlordShare');

        const tenantShare = web3.utils.toWei(tenantShareInput.value, 'ether');
        const landlordShare = web3.utils.toWei(landlordShareInput.value, 'ether');

        const accounts = await web3.eth.getAccounts();
        const landlord = accounts[0];

        // Call the smart contract to refund the deposit
        await contractInstance.methods.refundDeposit(tenantShare, landlordShare).send({ from: landlord });

        // Update status
        checkDepositStatus();
    } catch (error) {
        console.error(error);
    }
}

async function signContract() {
    try {
        // Fetch EVM accounts and sign contract
        const accounts = await web3.eth.getAccounts();
        const tenant = accounts[0];
        await contractInstance.methods.signContract().send({ from: tenant });

        // Update status after contract signing
        checkDepositStatus();
    } catch (error) {
        console.error('Error signing contract:', error);
    }
}
